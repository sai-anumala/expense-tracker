import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseTransferInput, toTransferDto } from "@/lib/transferInput";
import { TransferModel } from "@/models/Transfer";

export const dynamic = "force-dynamic";

/** GET /api/transfers — the signed-in user's transfers between own accounts, newest first. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const docs = await TransferModel.find({ userId: user.userId }).sort({ date: -1 }).limit(1000).lean();
    return ok(docs.map(toTransferDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/transfers", "Failed to load transfers.");
  }
}

/** POST /api/transfers — record money moved between two of the user's own accounts. */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const input = parseTransferInput(body);
  if (!input.ok) return fail(400, input.error);

  try {
    await connectDb();
    const doc = await TransferModel.create({ ...input.value, userId: user.userId });
    return ok(toTransferDto(doc.toObject()), 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/transfers", "Failed to save transfer.");
  }
}
