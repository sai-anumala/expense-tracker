import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { normalizeEmail } from "@/lib/authInput";
import { MINUTE, check, clear, clientIp, hit, rateKey, tooMany } from "@/lib/rateLimit";
import { withDeadline } from "@/lib/deadline";
import { isAuthConfigured } from "@/lib/session";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

const DEADLINE_MS = 12_000;

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12));
const BAD_LOGIN = "Incorrect email or password.";

const WINDOW_MS = 15 * MINUTE;
/** Failed attempts per email per window (the next attempt is refused, even with the right password). */
const EMAIL_FAIL_LIMIT = 5;
/** All attempts per client IP per window. */
const IP_LIMIT = 20;

/** POST /api/auth/login { email, password } */
export function POST(req: Request) {
  // Answer before the browser gives up (15 s), with a clear log line, instead of hanging to the platform's 300 s limit.
  return withDeadline(handle(req), DEADLINE_MS, () => {
    console.error("POST /api/auth/login timed out");
    return fail(503, "Signing in is taking too long. Please try again.");
  });
}

async function handle(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  if (!isAuthConfigured()) return fail(503, "Sign-in isn't configured on the server (AUTH_SECRET missing).");

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return fail(400, "Enter your email and password.");

  // Rate limits (fail open): every attempt counts per IP; only failures count per email.
  const ipLimit = await hit(rateKey("ip", clientIp(req)), IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) return tooMany("login attempts", ipLimit.retryAfterSec);
  const emailKey = rateKey("login", email);
  const emailLimit = await check(emailKey, EMAIL_FAIL_LIMIT);
  if (!emailLimit.allowed) return tooMany("login attempts", emailLimit.retryAfterSec);

  try {
    await connectDb();
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    const valid = await bcrypt.compare(password.slice(0, 72), user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) {
      await hit(emailKey, EMAIL_FAIL_LIMIT, WINDOW_MS);
      return fail(401, BAD_LOGIN);
    }
    await clear(emailKey);

    const session = { userId: user._id.toString(), email: user.email, name: user.name };
    return setSessionCookie(ok({ id: session.userId, name: user.name, email: user.email }), session);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/auth/login", "Could not sign you in. Please try again.");
  }
}
