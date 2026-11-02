import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseLoanInput, toLoanDto } from "@/lib/loanInput";
import { LoanModel } from "@/models/Loan";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const LOAN_NOT_FOUND = "This loan no longer exists. It may have been deleted.";

/** PUT /api/loans/:id — edit a loan's details (payments are kept). */
export async function PUT(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, LOAN_NOT_FOUND);

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const input = parseLoanInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const existing = await LoanModel.findOne({ _id: id, userId: user.userId }).lean();
    if (!existing) return fail(404, LOAN_NOT_FOUND);

    const paid = (existing.payments ?? []).reduce((s, p) => s + p.amount, 0);
    if (input.value.totalDue + 0.005 < paid)
      return fail(400, "Total to repay can't be less than what has already been repaid.");
    const firstPayment = (existing.payments ?? []).reduce<Date | null>(
      (min, p) => (!min || p.date < min ? p.date : min),
      null,
    );
    if (firstPayment && input.value.date > firstPayment)
      return fail(400, "Loan date can't be after its first repayment.");

    const { dueDate, monthlyPayment, paymentDay, account, note, ...required } = input.value;
    const set: Record<string, unknown> = { ...required };
    const unset: Record<string, 1> = {};
    for (const [k, v] of Object.entries({ dueDate, monthlyPayment, paymentDay, account, note })) {
      if (v === undefined) unset[k] = 1;
      else set[k] = v;
    }
    const doc = await LoanModel.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) return fail(404, LOAN_NOT_FOUND);
    return ok(toLoanDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/loans/:id", "Failed to update loan.");
  }
}

/** DELETE /api/loans/:id — removes the loan and all its repayments. */
export async function DELETE(_req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, LOAN_NOT_FOUND);
  try {
    await connectDb();
    const doc = await LoanModel.findOneAndDelete({ _id: id, userId: user.userId }).lean();
    if (!doc) return fail(404, LOAN_NOT_FOUND);
    return ok({ id });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/loans/:id", "Failed to delete loan.");
  }
}
