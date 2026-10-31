import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { fail } from "./api";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isAuthConfigured,
  verifySessionToken,
  type Session,
} from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** For API routes: the signed-in user's session, or a 401/503 response to return as-is. */
export async function requireUser(): Promise<Session | NextResponse> {
  if (!isAuthConfigured()) return fail(503, "Sign-in isn't configured on the server (AUTH_SECRET missing).");
  const session = await getSession();
  if (!session || !isValidObjectId(session.userId)) return fail(401, "Please log in to continue.");
  return session;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookie(res: NextResponse, s: Session) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(s), { ...cookieOptions, maxAge: SESSION_MAX_AGE });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
