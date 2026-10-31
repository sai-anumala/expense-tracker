import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { parseTransactionInput, toTransactionDto } from "@/lib/transactionInput";
import { TransactionModel } from "@/models/Transaction";

export const dynamic = "force-dynamic";

export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  try {
    await connectDb();
    const docs = await TransactionModel.find().sort({ date: -1 }).limit(500).lean();
    return ok(docs.map(toTransactionDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/transactions", "Failed to load transactions.");
  }
}

export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const input = parseTransactionInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const doc = await TransactionModel.create(input.value);
    return ok(toTransactionDto(doc.toObject()), 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/transactions", "Failed to save transaction.");
  }
}
