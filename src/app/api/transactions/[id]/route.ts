import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MISSING_CATEGORY, ownsCategories } from "@/lib/categoryAccess";
import { parseTransactionInput, toTransactionDto } from "@/lib/transactionInput";
import { TransactionModel } from "@/models/Transaction";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Same message for "doesn't exist" and "belongs to someone else", so IDs can't be probed.
const NOT_FOUND = "This transaction no longer exists. It may have been deleted.";

/** PUT /api/transactions/:id — replace one of the signed-in user's transactions. */
export async function PUT(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const input = parseTransactionInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    if (!(await ownsCategories(user.userId, [input.value.category]))) return fail(400, MISSING_CATEGORY);
    const { receiptName, ...fields } = input.value;
    const update: Record<string, unknown> = { $set: receiptName ? { ...fields, receiptName } : fields };
    // Clear the payment method if it was removed; keep an existing receipt unless a new one was attached.
    if (!fields.account) update.$unset = { account: 1 };
    const doc = await TransactionModel.findOneAndUpdate({ _id: id, userId: user.userId }, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok(toTransactionDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/transactions/:id", "Failed to update transaction.");
  }
}

/** DELETE /api/transactions/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);
  try {
    await connectDb();
    const doc = await TransactionModel.findOneAndDelete({ _id: id, userId: user.userId }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok({ id });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/transactions/:id", "Failed to delete transaction.");
  }
}
