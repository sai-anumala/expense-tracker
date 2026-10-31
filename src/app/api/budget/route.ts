import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { MAX_AMOUNT, dbErrorResponse, fail, ok, readJsonObject, requireDb, toPaise } from "@/lib/api";
import { BudgetModel } from "@/models/Budget";
import { CATEGORY_IDS } from "@/models/Transaction";

export const dynamic = "force-dynamic";

const KEY = "default";

type Lean = { monthlyLimit?: number; categories?: { category: string; limit: number }[] };
const toDto = (d: Lean | null) => ({
  monthlyLimit: d?.monthlyLimit ?? 0,
  categories: (d?.categories ?? []).map(({ category, limit }) => ({ category, limit })),
});

export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  try {
    await connectDb();
    const doc = await BudgetModel.findOne({ key: KEY }).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/budget", "Failed to load budget.");
  }
}

/** PUT replaces the whole budget: { monthlyLimit, categories: [{ category, limit }] }. */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
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
    if (!CATEGORY_IDS.includes(category as (typeof CATEGORY_IDS)[number]) || category === "income")
      return fail(400, "Unknown budget category.");
    if (!Number.isFinite(limit) || limit <= 0) return fail(400, "Category limit must be more than 0.");
    if (limit > MAX_AMOUNT) return fail(400, "Category limit is too large.");
    if (seen.has(category)) return fail(400, "Each category can only have one budget.");
    seen.add(category);
    categories.push({ category, limit: toPaise(limit) });
  }

  try {
    await connectDb();
    const doc = await BudgetModel.findOneAndUpdate(
      { key: KEY },
      { $set: { monthlyLimit: toPaise(monthlyLimit), categories } },
      { upsert: true, new: true, runValidators: true },
    ).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/budget", "Failed to save budget.");
  }
}
