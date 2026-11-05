import { NextResponse } from "next/server";
import { connectDb, ensureIndexes } from "@/lib/db";
import { dbErrorResponse, ok, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { generateCaptureToken, hashCaptureToken } from "@/lib/captureToken";
import { CaptureTokenModel } from "@/models/CaptureToken";

export const dynamic = "force-dynamic";

/** GET /api/capture/token — whether the user has a token and when it was last used. Never returns the token. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const doc = await CaptureTokenModel.findOne({ userId: user.userId }).lean();
    return ok({
      exists: Boolean(doc),
      createdAt: doc ? new Date(doc.createdAt).toISOString() : null,
      lastUsedAt: doc?.lastUsedAt ? new Date(doc.lastUsedAt).toISOString() : null,
    });
  } catch (err) {
    return dbErrorResponse(err, "GET /api/capture/token", "Failed to load auto-capture settings.");
  }
}

/** POST /api/capture/token — create or regenerate. The plain token is returned only here; the old one stops working. */
export async function POST() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    await ensureIndexes(CaptureTokenModel);
    const token = generateCaptureToken();
    await CaptureTokenModel.deleteOne({ userId: user.userId });
    const doc = await CaptureTokenModel.create({ userId: user.userId, tokenHash: hashCaptureToken(token) });
    return ok({ token, createdAt: new Date(doc.createdAt).toISOString() }, 201);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/capture/token", "Failed to create the token.");
  }
}

/** DELETE /api/capture/token — revoke. Alerts already waiting for review are kept. */
export async function DELETE() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    await CaptureTokenModel.deleteOne({ userId: user.userId });
    return ok({ revoked: true });
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/capture/token", "Failed to revoke the token.");
  }
}
