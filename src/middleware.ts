import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Pages that don't need a session. Signed-in users visiting them are sent to the app. */
const AUTH_PAGES = ["/login", "/signup"];
/** API routes reachable without a session. */
const PUBLIC_API = ["/api/auth/login", "/api/auth/signup", "/api/auth/logout", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (session || PUBLIC_API.includes(pathname)) return NextResponse.next();
    return NextResponse.json({ success: false, error: "Please log in to continue." }, { status: 401 });
  }

  if (AUTH_PAGES.includes(pathname)) {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
