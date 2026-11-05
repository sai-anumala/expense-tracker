import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, ensureIndexes } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { customCategoryId, toCustomCategoryDto } from "@/lib/categoryAccess";
import { validateCategoryName } from "@/lib/categoryRules";
import { builtInCategoryByName, categoryInfo } from "@/lib/data";
import { BudgetModel } from "@/models/Budget";
import { CustomCategoryModel } from "@/models/CustomCategory";
import { TransactionModel } from "@/models/Transaction";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Same message for "doesn't exist" and "belongs to someone else", so IDs can't be probed.
const NOT_FOUND = "This category no longer exists.";

/** PUT /api/categories/:id { name }: rename. Expenses and budgets refer to the id, so they follow automatically. */
export async function PUT(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const parsed = validateCategoryName(body.name);
  if (!parsed.ok) return fail(400, parsed.error);
  const builtIn = builtInCategoryByName(parsed.name);
  if (builtIn) return fail(409, `"${categoryInfo(builtIn, []).long}" is already a category.`);

  try {
    await connectDb();
    await ensureIndexes(CustomCategoryModel);
    const doc = await CustomCategoryModel.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { $set: { name: parsed.name, nameKey: parsed.key } },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok(toCustomCategoryDto(doc));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fail(409, `You already have a category called "${parsed.name}".`);
    return dbErrorResponse(err, "PUT /api/categories/:id", "Failed to rename the category.");
  }
}

/** DELETE /api/categories/:id: its expenses move to Other, its budget is removed; no amount changes. Safe to retry. */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);
  try {
    await connectDb();
    const owned = { _id: id, userId: user.userId };
    const doc = await CustomCategoryModel.findOne(owned).lean();
    if (!doc) return fail(404, NOT_FOUND);
    const category = customCategoryId(doc._id);
    // The category goes last: if a step fails, it's still there to delete again and nothing points at a missing id.
    const moved = await TransactionModel.updateMany({ userId: user.userId, category }, { $set: { category: "other" } });
    await BudgetModel.updateOne({ key: user.userId }, { $pull: { categories: { category } } });
    await CustomCategoryModel.deleteOne(owned);
    return ok({ id: category, moved: moved.modifiedCount });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/categories/:id", "Failed to delete the category.");
  }
}
