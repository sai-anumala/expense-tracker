import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, ok, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toCapturedDto } from "@/lib/captureToken";
import { CapturedTransactionModel } from "@/models/CapturedTransaction";

export const dynamic = "force-dynamic";

/** GET /api/captured — bank alerts waiting for review, newest first. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const docs = await CapturedTransactionModel.find({ userId: user.userId }).sort({ receivedAt: -1 }).limit(500).lean();
    return ok(docs.map(toCapturedDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/captured", "Failed to load alerts to review.");
  }
}
