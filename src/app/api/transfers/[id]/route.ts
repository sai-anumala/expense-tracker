import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseTransferInput, toTransferDto } from "@/lib/transferInput";
import { TransferModel } from "@/models/Transfer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Same message for "doesn't exist" and "belongs to someone else", so IDs can't be probed.
const NOT_FOUND = "This transfer no longer exists. It may have been deleted.";

/** PUT /api/transfers/:id — replace one of the signed-in user's transfers. */
export async function PUT(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const input = parseTransferInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const { note, ...fields } = input.value;
    const update: Record<string, unknown> = { $set: note ? { ...fields, note } : fields };
    if (!note) update.$unset = { note: 1 }; // note removed → clear it
    const doc = await TransferModel.findOneAndUpdate({ _id: id, userId: user.userId }, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok(toTransferDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/transfers/:id", "Failed to update transfer.");
  }
}

/** DELETE /api/transfers/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);
  try {
    await connectDb();
    const doc = await TransferModel.findOneAndDelete({ _id: id, userId: user.userId }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok({ id });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/transfers/:id", "Failed to delete transfer.");
  }
}
