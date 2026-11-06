import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/lib/authInput";
import { HOUR, clientIp, hit, rateKey, tooMany } from "@/lib/rateLimit";
import { withDeadline } from "@/lib/deadline";
import { isAuthConfigured } from "@/lib/session";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

const DEADLINE_MS = 12_000;

const SIGNUP_LIMIT = 10;

/** POST /api/auth/signup { name, email, password } — creates an account and signs in. */
export function POST(req: Request) {
  // Answer before the browser gives up (15 s), with a clear log line, instead of hanging to the platform's 300 s limit.
  return withDeadline(handle(req), DEADLINE_MS, () => {
    console.error("POST /api/auth/signup timed out");
    return fail(503, "Creating your account is taking too long. Please try again.");
  });
}

async function handle(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  if (!isAuthConfigured()) return fail(503, "Sign-up isn't configured on the server (AUTH_SECRET missing).");

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const { name, error: nameError } = validateName(body.name);
  if (nameError) return fail(400, nameError);
  const email = normalizeEmail(body.email);
  const emailError = validateEmail(email);
  if (emailError) return fail(400, emailError);
  const pwError = validatePassword(body.password);
  if (pwError) return fail(400, pwError);

  // Max SIGNUP_LIMIT valid sign-up attempts per IP per hour (fails open if the counter errors).
  const limit = await hit(rateKey("signup-ip", clientIp(req)), SIGNUP_LIMIT, HOUR);
  if (!limit.allowed) return tooMany("sign-up attempts from this network", limit.retryAfterSec);

  try {
    await connectDb();
    if (await UserModel.exists({ email })) return fail(409, "An account with this email already exists. Try logging in.");
    const passwordHash = await bcrypt.hash(body.password as string, 12);
    const user = await UserModel.create({ name, email, passwordHash });
    const session = { userId: user._id.toString(), email: user.email, name: user.name };
    return setSessionCookie(ok({ id: session.userId, name, email }, 201), session);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return fail(409, "An account with this email already exists. Try logging in.");
    return dbErrorResponse(err, "POST /api/auth/signup", "Could not create your account. Please try again.");
  }
}
