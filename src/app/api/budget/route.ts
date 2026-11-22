import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_AMOUNT, dbErrorResponse, fail, ok, readJsonObject, requireDb, toPaise } from "@/lib/api";
import { BudgetModel } from "@/models/Budget";
import { isCategoryId } from "@/models/Transaction";
import { MISSING_CATEGORY, ownsCategories } from "@/lib/categoryAccess";
import { parseBudgetMonth } from "@/lib/budgetInput";
import { upsertHistory } from "@/lib/budgetHistory";
import type { BudgetEntry } from "@/lib/data";

export const dynamic = "force-dynamic";


type Limits = { category: string; limit: number }[];
type Lean = { monthlyLimit?: number; categories?: Limits; history?: { month: string; monthlyLimit: number; categories?: Limits }[] };
const limitsDto = (l: Limits | undefined) => (l ?? []).map(({ category, limit }) => ({ category, limit }));
const toDto = (d: Lean | null) => ({
  monthlyLimit: d?.monthlyLimit ?? 0,
  categories: limitsDto(d?.categories),
  history: (d?.history ?? []).map((h) => ({ month: h.month, monthlyLimit: h.monthlyLimit, categories: limitsDto(h.categories) })),
});

export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const doc = await BudgetModel.findOne({ key: user.userId }).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/budget", "Failed to load budget.");
  }
}

/**
 * PUT replaces the whole budget: { monthlyLimit, categories: [{ category, limit }], month? }.
 * With `month` ("YYYY-MM", the user's local month) the saved budget is also kept as that month's entry
 * in `history`, so past months can be shown against the limit they had (last save in a month wins).
 */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const monthlyLimit = Number(body.monthlyLimit);
  if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) return fail(400, "Monthly limit must be 0 or more.");
  if (monthlyLimit > MAX_AMOUNT) return fail(400, "Monthly limit is too large.");
  if (!Array.isArray(body.categories)) return fail(400, "Category budgets must be a list.");

  const seen = new Set<string>();
  const categories: { category: string; limit: number }[] = [];
  for (const c of body.categories as unknown[]) {
    const item = (c && typeof c === "object" ? c : {}) as { category?: unknown; limit?: unknown };
    const category = String(item.category);
    const limit = Number(item.limit);
    if (!isCategoryId(category) || category === "income")
      return fail(400, "Unknown budget category.");
    if (!Number.isFinite(limit) || limit <= 0) return fail(400, "Category limit must be more than 0.");
    if (limit > MAX_AMOUNT) return fail(400, "Category limit is too large.");
    if (seen.has(category)) return fail(400, "Each category can only have one budget.");
    seen.add(category);
    categories.push({ category, limit: toPaise(limit) });
  }

  const month = parseBudgetMonth(body.month);
  if (!month.ok) return fail(400, month.error);

  try {
    await connectDb();
    if (!(await ownsCategories(user.userId, categories.map((c) => c.category)))) return fail(400, MISSING_CATEGORY);
    const set: Record<string, unknown> = { monthlyLimit: toPaise(monthlyLimit), categories };
    if (month.value) {
      const before = await BudgetModel.findOne({ key: user.userId }).lean<Lean>();
      const entry = { month: month.value, monthlyLimit: set.monthlyLimit as number, categories } as BudgetEntry;
      set.history = upsertHistory(toDto(before).history as BudgetEntry[], entry);
    }
    const doc = await BudgetModel.findOneAndUpdate(
      { key: user.userId },
      { $set: set },
      { upsert: true, new: true, runValidators: true },
    ).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/budget", "Failed to save budget.");
  }
}
