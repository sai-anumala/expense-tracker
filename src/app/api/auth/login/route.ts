import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { normalizeEmail } from "@/lib/authInput";
import { isAuthConfigured } from "@/lib/session";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12));
const BAD_LOGIN = "Incorrect email or password.";

/** POST /api/auth/login { email, password } */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  if (!isAuthConfigured()) return fail(503, "Sign-in isn't configured on the server (AUTH_SECRET missing).");

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return fail(400, "Enter your email and password.");

  try {
    await connectDb();
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    const valid = await bcrypt.compare(password.slice(0, 72), user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) return fail(401, BAD_LOGIN);

    const session = { userId: user._id.toString(), email: user.email, name: user.name };
    return setSessionCookie(ok({ id: session.userId, name: user.name, email: user.email }), session);
  } catch (err) {
    return dbErrorResponse(err, "POST /api/auth/login", "Could not sign you in. Please try again.");
  }
}
