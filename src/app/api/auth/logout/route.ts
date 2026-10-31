import { ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — clears the session cookie. */
export async function POST() {
  return clearSessionCookie(ok({ loggedOut: true }));
}
