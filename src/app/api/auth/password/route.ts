import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { validatePassword } from "@/lib/authInput";
import { MINUTE, check, clear, hit, rateKey, tooMany } from "@/lib/rateLimit";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

/** Wrong current-password attempts allowed per user per window. */
const WRONG_LIMIT = 5;
const WINDOW_MS = 15 * MINUTE;

/** POST /api/auth/password { currentPassword, newPassword } — change the signed-in user's password. */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const session = await requireUser();
  if (session instanceof NextResponse) return session;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  if (!current) return fail(400, "Enter your current password.");
  const newError = validatePassword(body.newPassword);
  if (newError) return fail(400, newError.replace(/^Password/, "New password"));
  const next = body.newPassword as string;
  if (next === current) return fail(400, "New password must be different.");

  const key = rateKey("pwchange", session.userId);
  const limit = await check(key, WRONG_LIMIT);
  if (!limit.allowed) return tooMany("wrong password attempts", limit.retryAfterSec);

  try {
    await connectDb();
    const user = await UserModel.findById(session.userId).select("+passwordHash");
    if (!user) return clearSessionCookie(fail(401, "Your account no longer exists. Please sign up again."));
    if (!(await bcrypt.compare(current.slice(0, 72), user.passwordHash))) {
      await hit(key, WRONG_LIMIT, WINDOW_MS);
      return fail(400, "Current password is incorrect.");
    }
    user.passwordHash = await bcrypt.hash(next, 12);
    await user.save();
    await clear(key);
    return ok({ changed: true });
  } catch (err) {
    return dbErrorResponse(err, "POST /api/auth/password", "Could not change your password. Please try again.");
  }
}
