// Where to go after logging in. The value comes from the URL, so anyone can craft it.

const BASE = "https://ledgerly.invalid";

/**
 * A path on this site, or "/". Checks where the browser would really end up, not how the text starts: browsers treat
 * "\" as "/" and drop tabs and newlines, so "/\evil.example" and "/<tab>/evil.example" both leave the site.
 */
export function safeNext(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/")) return "/";
  try {
    const url = new URL(raw, BASE);
    // "/.//evil.example" stays on this origin here but tidies to "//evil.example", which leaves it when followed.
    if (url.origin !== BASE || url.pathname.startsWith("//")) return "/";
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/signup")) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
