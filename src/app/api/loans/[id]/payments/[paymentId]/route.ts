import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toLoanDto } from "@/lib/loanInput";
import { LoanModel } from "@/models/Loan";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; paymentId: string }> };

/** DELETE /api/loans/:id/payments/:paymentId — undo a repayment. Returns the updated loan. */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id, paymentId } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(paymentId)) return fail(404, "Repayment not found.");
  try {
    await connectDb();
    const doc = await LoanModel.findOneAndUpdate(
      { _id: id, userId: user.userId, "payments._id": paymentId },
      { $pull: { payments: { _id: paymentId } } },
      { new: true },
    ).lean();
    if (!doc) return fail(404, "Repayment not found.");
    return ok(toLoanDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/loans/:id/payments/:paymentId", "Failed to remove repayment.");
  }
}
