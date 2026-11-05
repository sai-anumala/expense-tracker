import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CapturedTransactionModel } from "@/models/CapturedTransaction";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/captured/:id — dismiss an alert ("Not a transaction"). */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const notFound = "This alert no longer exists.";
  if (!isValidObjectId(id)) return fail(404, notFound);
  try {
    await connectDb();
    const doc = await CapturedTransactionModel.findOneAndDelete({ _id: id, userId: user.userId }).lean();
    if (!doc) return fail(404, notFound);
    return ok({ id });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/captured/:id", "Failed to dismiss the alert.");
  }
}
