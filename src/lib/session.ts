// Session tokens (JWT, HS256). Edge-safe: used by middleware and API routes.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ledgerly_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export type Session = { userId: string; email: string; name: string };

export function isAuthConfigured() {
  return (process.env.AUTH_SECRET ?? "").length >= 32;
}

function secretKey() {
  if (!isAuthConfigured()) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function createSessionToken(s: Session) {
  return new SignJWT({ email: s.email, name: s.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Returns the session, or null if the token is missing, invalid, expired, or auth isn't configured. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token || !isAuthConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { userId: payload.sub, email: String(payload.email ?? ""), name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
