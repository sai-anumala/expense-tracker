import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AMOUNT } from "../api";
import { parseTransactionInput } from "../transactionInput";

const NOW = new Date("2026-11-03T06:30:00.000Z"); // 12:00 IST
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

const valid = { merchant: "Swiggy", category: "food", amount: -250, date: "2026-11-03T05:00:00.000Z" };
const parse = (over: Record<string, unknown> = {}) => parseTransactionInput({ ...valid, ...over });
const errorOf = (over: Record<string, unknown>) => {
  const r = parse(over);
  return r.ok ? null : r.error;
};

describe("parseTransactionInput", () => {
  it("accepts a valid expense and returns clean values", () => {
    expect(parse({ merchant: "  Swiggy  ", account: " UPI " })).toEqual({
      ok: true,
      value: { merchant: "Swiggy", category: "food", amount: -250, date: new Date(valid.date), account: "UPI", receiptName: undefined },
    });
  });

  it("accepts positive income and numeric strings", () => {
    const r = parse({ category: "income", amount: "45000" });
    expect(r.ok && r.value.amount).toBe(45000);
  });

  it("income must be positive and expenses negative", () => {
    const msg = "Income must be positive and expenses negative.";
    expect(errorOf({ category: "income", amount: -10 })).toBe(msg);
    expect(errorOf({ category: "food", amount: 10 })).toBe(msg);
  });

  it("rejects zero, non-numeric and non-finite amounts", () => {
    for (const amount of [0, "abc", NaN, Infinity, undefined, null, ""]) {
      expect(errorOf({ amount })).toBe("Amount must be a non-zero number.");
    }
  });

  it("enforces MAX_AMOUNT on the absolute value", () => {
    expect(parse({ amount: -MAX_AMOUNT }).ok).toBe(true);
    expect(errorOf({ amount: -(MAX_AMOUNT + 1) })).toBe("Amount is too large.");
    expect(errorOf({ category: "income", amount: MAX_AMOUNT + 0.01 })).toBe("Amount is too large.");
  });

  it("rounds to paise", () => {
    const r = parse({ amount: -10.006 });
    expect(r.ok && r.value.amount).toBe(-10.01);
    const r2 = parse({ amount: -0.1234 });
    expect(r2.ok && r2.value.amount).toBe(-0.12);
  });

  it("merchant is required (after trimming) and ≤ 120 chars", () => {
    expect(errorOf({ merchant: "   " })).toBe("Merchant or note is required.");
    expect(errorOf({ merchant: 42 })).toBe("Merchant or note is required.");
    expect(parse({ merchant: "x".repeat(120) }).ok).toBe(true);
    expect(errorOf({ merchant: "x".repeat(121) })).toBe("Merchant or note must be 120 characters or fewer.");
  });

  it("rejects unknown categories", () => {
    expect(errorOf({ category: "crypto" })).toBe("Unknown category.");
    expect(errorOf({ category: undefined })).toBe("Unknown category.");
  });

  it("accepts the legacy 'hardware' category", () => {
    expect(parse({ category: "hardware" }).ok).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(errorOf({ date: "yesterday-ish" })).toBe("Invalid date.");
    expect(errorOf({ date: undefined })).toBe("Invalid date.");
  });

  it("allows up to 5 minutes in the future (clock skew), rejects later", () => {
    expect(parse({ date: new Date(NOW.getTime() + 5 * 60_000).toISOString() }).ok).toBe(true);
    expect(errorOf({ date: new Date(NOW.getTime() + 5 * 60_000 + 1).toISOString() })).toBe("Date can't be in the future.");
  });

  it("account: blank → undefined, ≤ 80 chars", () => {
    const r = parse({ account: "   " });
    expect(r.ok && r.value.account).toBeUndefined();
    expect(parse({ account: "a".repeat(80) }).ok).toBe(true);
    expect(errorOf({ account: "a".repeat(81) })).toBe("Payment method name is too long.");
  });

  it("receiptName is truncated to 200 chars; non-strings ignored", () => {
    const r = parse({ receiptName: "r".repeat(250) });
    expect(r.ok && r.value.receiptName).toHaveLength(200);
    const r2 = parse({ receiptName: 5 });
    expect(r2.ok && r2.value.receiptName).toBeUndefined();
  });

  it("ignores unknown fields such as the old subcategory", () => {
    const r = parse({ subcategory: "pizza" });
    expect(r.ok && Object.keys(r.value)).not.toContain("subcategory");
  });
});
