import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, requireDb } from "@/lib/api";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — the signed-in user (re-read from the DB so deleted accounts are logged out). */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  try {
    await connectDb();
    const user = await UserModel.findById(session.userId).lean();
    if (!user) return clearSessionCookie(fail(401, "Your account no longer exists. Please sign up again."));
    return ok({ id: session.userId, name: user.name, email: user.email });
  } catch (err) {
    return dbErrorResponse(err, "GET /api/auth/me", "Could not load your account.");
  }
}
