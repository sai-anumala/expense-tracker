import { describe, expect, it } from "vitest";
import { buildGmailScript } from "../gmailScript";

describe("buildGmailScript", () => {
  const script = buildGmailScript("https://example.test/", "ldg_abc");

  it("fills in the endpoint and token", () => {
    expect(script).toContain('const LEDGERLY_URL = "https://example.test/api/capture/email";');
    expect(script).toContain('const LEDGERLY_TOKEN = "ldg_abc";');
  });
  it("is valid JavaScript", () => {
    expect(() => new Function(script)).not.toThrow();
  });
  it("escapes values safely", () => {
    expect(() => new Function(buildGmailScript("https://x.test", 'a"b\\c'))).not.toThrow();
  });
});
