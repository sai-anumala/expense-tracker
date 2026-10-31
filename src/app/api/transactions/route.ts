import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseTransactionInput, toTransactionDto } from "@/lib/transactionInput";
import { TransactionModel } from "@/models/Transaction";

export const dynamic = "force-dynamic";

/** GET /api/transactions — the signed-in user's transactions, newest first. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const docs = await TransactionModel.find({ userId: user.userId }).sort({ date: -1 }).limit(1000).lean();
    return ok(docs.map(toTransactionDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/transactions", "Failed to load transactions.");
  }
}

export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const input = parseTransactionInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const doc = await TransactionModel.create({ ...input.value, userId: user.userId });
    return ok(toTransactionDto(doc.toObject()), 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/transactions", "Failed to save transaction.");
  }
}
