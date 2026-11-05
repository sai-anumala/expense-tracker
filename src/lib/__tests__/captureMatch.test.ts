import { describe, expect, it } from "vitest";
import { possibleDuplicate, suggestCategory, type CapturedItem } from "../captureMatch";
import type { Transfer } from "../transfers";
import { iso, tx } from "./fixtures";

const item = (over: Partial<CapturedItem> = {}): CapturedItem => ({
  id: "c1",
  text: "x",
  receivedAt: iso(2026, 11, 5, 12),
  amount: 500,
  kind: "expense",
  ...over,
});
const transfer = (amount: number, date: string): Transfer => ({ id: "tr1", from: "bank", to: "card", amount, date });

describe("suggestCategory", () => {
  it("uses the most recent category for the same merchant, ignoring case", () => {
    const list = [
      tx(-100, iso(2026, 10, 1), { merchant: "Zomato", category: "food" }),
      tx(-100, iso(2026, 11, 1), { merchant: "ZOMATO", category: "fun" }),
    ];
    expect(suggestCategory("zomato", list)).toBe("fun");
  });
  it("null for an unknown or missing merchant, and never suggests income", () => {
    const list = [tx(500, iso(2026, 11, 1), { merchant: "Ravi", category: "income" })];
    expect(suggestCategory("Ravi", list)).toBeNull();
    expect(suggestCategory("Nobody", list)).toBeNull();
    expect(suggestCategory(undefined, list)).toBeNull();
  });
});

describe("possibleDuplicate", () => {
  it("matches the same amount within a day in transactions, transfers or other alerts", () => {
    expect(possibleDuplicate(item(), [tx(-500, iso(2026, 11, 5, 9))], [], [])).toBe(true);
    expect(possibleDuplicate(item(), [], [transfer(500, iso(2026, 11, 4, 13))], [])).toBe(true);
    expect(possibleDuplicate(item(), [], [], [item({ id: "c2", receivedAt: iso(2026, 11, 5, 12, 1) })])).toBe(true);
  });
  it("money received never matches money sent, in either direction", () => {
    const received = item({ kind: "income" });
    expect(possibleDuplicate(received, [tx(-500, iso(2026, 11, 5, 9))], [], [])).toBe(false);
    expect(possibleDuplicate(received, [], [transfer(500, iso(2026, 11, 5, 9))], [])).toBe(false);
    expect(possibleDuplicate(received, [], [], [item({ id: "c2" })])).toBe(false);
    expect(possibleDuplicate(item(), [tx(500, iso(2026, 11, 5, 9))], [], [])).toBe(false);
    expect(possibleDuplicate(item(), [], [], [item({ id: "c2", kind: "income" })])).toBe(false);
  });
  it("still flags the same direction", () => {
    expect(possibleDuplicate(item({ kind: "income" }), [tx(500, iso(2026, 11, 5, 9))], [], [])).toBe(true);
    expect(possibleDuplicate(item({ kind: "income" }), [], [], [item({ id: "c2", kind: "income" })])).toBe(true);
    expect(possibleDuplicate(item({ kind: "cardBill" }), [], [], [item({ id: "c2" })])).toBe(true);
  });
  it("no match for a different amount, an older record, or the item itself", () => {
    expect(possibleDuplicate(item(), [tx(-501, iso(2026, 11, 5, 9))], [], [])).toBe(false);
    expect(possibleDuplicate(item(), [tx(-500, iso(2026, 11, 3, 9))], [], [])).toBe(false);
    expect(possibleDuplicate(item(), [], [], [item()])).toBe(false);
  });
});
