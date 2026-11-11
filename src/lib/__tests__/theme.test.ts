import { describe, expect, it } from "vitest";
import { parseThemePref, resolveTheme, themeCookie, themeInitScript, themePrefFromCookie } from "@/lib/theme";

describe("parseThemePref", () => {
  it("accepts the three choices", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
  });
  it("defaults to light for missing or unknown values", () => {
    for (const v of [undefined, null, "", "DARK", "blue", "dark "]) expect(parseThemePref(v)).toBe("light");
  });
});

describe("themePrefFromCookie", () => {
  it("finds the cookie among others", () => {
    expect(themePrefFromCookie("a=1; ledgerly_theme=dark; b=2")).toBe("dark");
    expect(themePrefFromCookie("ledgerly_theme=system")).toBe("system");
  });
  it("ignores look-alike names and bad values", () => {
    expect(themePrefFromCookie("xledgerly_theme=dark")).toBe("light");
    expect(themePrefFromCookie("ledgerly_theme=evil")).toBe("light");
    expect(themePrefFromCookie("")).toBe("light");
  });
});

describe("resolveTheme", () => {
  it("uses the fixed choice regardless of the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the device for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("themeCookie / themeInitScript", () => {
  it("writes a year-long site-wide cookie", () => {
    expect(themeCookie("dark")).toBe("ledgerly_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax");
  });
  it("is valid JavaScript and defaults to light", () => {
    expect(() => new Function(themeInitScript)).not.toThrow();
    expect(themeInitScript).toContain('p=m?m[1]:"light"');
  });
});

/** Runs the head script against a tiny fake document, the way a browser would before first paint. */
function runScript(cookie: string, systemDark: boolean) {
  const listeners: (() => void)[] = [];
  const query = { matches: systemDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) };
  let meta: { name?: string; content?: string } | null = null;
  const root = { dataset: {} as Record<string, string> };
  const doc = {
    cookie,
    documentElement: root,
    querySelector: () => meta,
    createElement: () => ({}),
    head: { appendChild: (m: { name?: string; content?: string }) => (meta = m) },
  };
  const win: { __ledgerlyTheme?: (p: string) => void } = {};
  new Function("document", "window", "matchMedia", themeInitScript)(doc, win, () => query);
  return {
    root,
    meta: () => meta,
    win,
    systemChange(dark: boolean) {
      query.matches = dark;
      listeners.forEach((fn) => fn());
    },
  };
}

describe("themeInitScript in a page", () => {
  it("starts light with no cookie and sets the browser bar colour", () => {
    const page = runScript("", true);
    expect(page.root.dataset).toEqual({ theme: "light", themePref: "light" });
    expect(page.meta()?.content).toBe("#f7f9ff");
  });
  it("applies a saved dark choice", () => {
    const page = runScript("ledgerly_theme=dark", false);
    expect(page.root.dataset.theme).toBe("dark");
    expect(page.meta()?.content).toBe("#0f1419");
  });
  it("follows the device live only while the choice is system", () => {
    const page = runScript("ledgerly_theme=system", false);
    expect(page.root.dataset.theme).toBe("light");
    page.systemChange(true);
    expect(page.root.dataset.theme).toBe("dark");
    page.win.__ledgerlyTheme!("light");
    page.systemChange(true);
    expect(page.root.dataset).toEqual({ theme: "light", themePref: "light" });
  });
});
