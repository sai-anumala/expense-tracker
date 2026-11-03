import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AMOUNT } from "../api";
import { parseTransferInput, toTransferDto } from "../transferInput";

const NOW = new Date("2026-11-03T06:30:00.000Z"); // 12:00 IST
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

const valid = { from: "bank", to: "cash", amount: 2000, date: "2026-11-03T05:00:00.000Z" };
const parse = (over: Record<string, unknown> = {}) => parseTransferInput({ ...valid, ...over });
const errorOf = (over: Record<string, unknown>) => {
  const r = parse(over);
  return r.ok ? null : r.error;
};

describe("parseTransferInput", () => {
  it("accepts a valid transfer and returns clean values", () => {
    expect(parse({ note: "  ATM  " })).toEqual({
      ok: true,
      value: { from: "bank", to: "cash", amount: 2000, date: new Date(valid.date), note: "ATM" },
    });
  });

  it("accepts every fixed account in both directions", () => {
    for (const from of ["bank", "upi", "cash", "card"])
      for (const to of ["bank", "upi", "cash", "card"]) {
        expect(parse({ from, to }).ok).toBe(from !== to);
      }
  });

  it("rejects unknown or missing accounts", () => {
    expect(errorOf({ from: "wallet" })).toBe("Choose the account the money came from.");
    expect(errorOf({ from: undefined })).toBe("Choose the account the money came from.");
    expect(errorOf({ to: "Bank" })).toBe("Choose the account the money went to.");
    expect(errorOf({ to: 1 })).toBe("Choose the account the money went to.");
  });

  it("from and to must differ", () => {
    expect(errorOf({ from: "cash", to: "cash" })).toBe("From and To must be different accounts.");
  });

  it("amount must be positive and finite", () => {
    for (const amount of [0, -5, "abc", NaN, Infinity, undefined, null, ""]) {
      expect(errorOf({ amount })).toBe("Amount must be more than zero.");
    }
    expect(errorOf({ amount: 0.004 })).toBe("Amount must be more than zero."); // rounds to ₹0.00
    const r = parse({ amount: "1500.5" });
    expect(r.ok && r.value.amount).toBe(1500.5);
  });

  it("enforces MAX_AMOUNT and rounds to paise", () => {
    expect(parse({ amount: MAX_AMOUNT }).ok).toBe(true);
    expect(errorOf({ amount: MAX_AMOUNT + 1 })).toBe("Amount is too large.");
    const r = parse({ amount: 10.006 });
    expect(r.ok && r.value.amount).toBe(10.01);
  });

  it("date must be valid and not in the future (5 minute tolerance)", () => {
    expect(errorOf({ date: "nope" })).toBe("Invalid date.");
    expect(errorOf({ date: undefined })).toBe("Invalid date.");
    expect(errorOf({ date: null })).toBe("Invalid date.");
    expect(parse({ date: new Date(NOW.getTime() + 4 * 60_000).toISOString() }).ok).toBe(true);
    expect(errorOf({ date: new Date(NOW.getTime() + 6 * 60_000).toISOString() })).toBe("Date can't be in the future.");
  });

  it("note is optional, trimmed, ≤ 120 chars", () => {
    const blank = parse({ note: "   " });
    expect(blank.ok && blank.value.note).toBeUndefined();
    expect(parse({ note: "x".repeat(120) }).ok).toBe(true);
    expect(errorOf({ note: "x".repeat(121) })).toBe("Note must be 120 characters or fewer.");
    expect(errorOf({ note: 42 })).toBe("Note must be text.");
  });

  it("ignores unknown fields (they are not copied to the value)", () => {
    const r = parse({ userId: "someone-else", extra: 1 });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(["amount", "date", "from", "note", "to"]);
  });
});

describe("toTransferDto", () => {
  it("maps a lean document", () => {
    expect(
      toTransferDto({ _id: { toString: () => "abc" }, from: "upi", to: "card", amount: 5, date: new Date(valid.date), note: null }),
    ).toEqual({ id: "abc", from: "upi", to: "card", amount: 5, date: valid.date, note: undefined });
  });
});
