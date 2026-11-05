import { describe, expect, it } from "vitest";
import { safeNext } from "../safeNext";

describe("safeNext", () => {
  it.each([
    ["/budgets", "/budgets"],
    ["/transactions?type=income&page=2", "/transactions?type=income&page=2"],
    ["/add?id=abc#top", "/add?id=abc#top"],
    ["/loans/6aece77dcee597980da1c72d", "/loans/6aece77dcee597980da1c72d"],
    ["/", "/"],
  ])("keeps %s", (raw, want) => {
    expect(safeNext(raw)).toBe(want);
  });

  it.each([
    ["//evil.example"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["/\r/evil.example"],
    ["/\\/evil.example"],
    ["/.//evil.example"],
    ["/x/..//evil.example"],
    ["/%2e//evil.example"],
    ["https://evil.example"],
    ["javascript:alert(1)"],
    [" /budgets"],
    ["budgets"],
    [""],
    [null],
    [undefined],
  ])("sends %j to Overview", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("never returns something that leaves the site when followed", () => {
    for (const raw of ["/\\/x", "/./\\/x", "/\t\\x", "/..//x", "/a/../../x", "/%5Cx", "/%2F%2Fx", "/%09/x"]) {
      const out = safeNext(raw);
      expect(new URL(out, "https://ledgerly.test").origin).toBe("https://ledgerly.test");
    }
  });

  it("doesn't send people back to the login or sign-up pages", () => {
    for (const raw of ["/login", "/login?next=/x", "/signup", "/./login", "/x/../signup"]) expect(safeNext(raw)).toBe("/");
  });
});
