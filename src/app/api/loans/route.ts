import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseLoanInput, toLoanDto } from "@/lib/loanInput";
import { LoanModel } from "@/models/Loan";

export const dynamic = "force-dynamic";

/** GET /api/loans — the signed-in user's loans (lent and borrowed), newest first. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const docs = await LoanModel.find({ userId: user.userId }).sort({ date: -1 }).limit(500).lean();
    return ok(docs.map(toLoanDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/loans", "Failed to load loans.");
  }
}

/** POST /api/loans — record money lent or borrowed. */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const input = parseLoanInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const doc = await LoanModel.create({ ...input.value, userId: user.userId, payments: [] });
    return ok(toLoanDto(doc.toObject()), 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/loans", "Failed to save loan.");
  }
}
