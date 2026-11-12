import { describe, expect, it } from "vitest";
import { buildGmailScript } from "../gmailScript";

describe("buildGmailScript", () => {
  const script = buildGmailScript("https://example.test/", "ldg_abc");

  it("fills in the endpoint and token", () => {
    expect(script).toContain('const LEDGERLY_URL = "https://example.test/api/capture/email";');
    expect(script).toContain('const LEDGERLY_TOKEN = "ldg_abc";');
  });
  it("starts with HDFC's alert sender", () => {
    expect(script).toContain('"alerts@hdfcbank.bank.in"');
  });
  it("setup removes only its own trigger", () => {
    expect(script).toContain('.filter((t) => t.getHandlerFunction() === "sendBankAlerts")');
  });
  it("saves a starting point when the trigger was added without setup", () => {
    expect(script).toContain("if (!props.getProperty(LAST_SENT)) {");
  });
  it("is valid JavaScript", () => {
    expect(() => new Function(script)).not.toThrow();
  });
  it("escapes values safely", () => {
    expect(() => new Function(buildGmailScript("https://x.test", 'a"b\\c'))).not.toThrow();
  });
});
