import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parsePaymentInput, toLoanDto } from "@/lib/loanInput";
import { LoanModel } from "@/models/Loan";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const NOT_FOUND = "This loan no longer exists. It may have been deleted.";

/** POST /api/loans/:id/payments — record a repayment (partial or full). Returns the updated loan. */
export async function POST(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const input = parsePaymentInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const loan = await LoanModel.findOne({ _id: id, userId: user.userId }).lean();
    if (!loan) return fail(404, NOT_FOUND);

    const paid = (loan.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.round((loan.totalDue - paid) * 100) / 100;
    if (outstanding <= 0) return fail(400, "This loan is already settled.");
    if (input.value.amount > outstanding + 0.005)
      return fail(400, `Repayment can't be more than the ₹${outstanding.toLocaleString("en-IN")} outstanding.`);
    if (input.value.date < loan.date) return fail(400, "Repayment date can't be before the loan date.");

    const doc = await LoanModel.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { $push: { payments: input.value } },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) return fail(404, NOT_FOUND);
    return ok(toLoanDto(doc), 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/loans/:id/payments", "Failed to record repayment.");
  }
}
