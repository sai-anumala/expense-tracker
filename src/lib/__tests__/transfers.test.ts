import { describe, expect, it } from "vitest";
import { isCardBill, isTransferAccount, mergeFeed, transferRoute, transferTotals, type Transfer } from "../transfers";

const tr = (id: string, date: string, over: Partial<Transfer> = {}): Transfer => ({
  id,
  from: "bank",
  to: "cash",
  amount: 100,
  date,
  ...over,
});
const tx = (id: string, date: string) => ({ id, date, amount: -50 });

describe("isCardBill", () => {
  it("is true when paying the credit card from another account", () => {
    expect(isCardBill({ from: "bank", to: "card" })).toBe(true);
    expect(isCardBill({ from: "upi", to: "card" })).toBe(true);
    expect(isCardBill({ from: "cash", to: "card" })).toBe(true);
  });
  it("is false for other pairs", () => {
    expect(isCardBill({ from: "card", to: "bank" })).toBe(false);
    expect(isCardBill({ from: "bank", to: "cash" })).toBe(false);
    expect(isCardBill({ from: "card", to: "card" })).toBe(false);
  });
});

describe("labels", () => {
  it("formats the route", () => {
    expect(transferRoute({ from: "bank", to: "cash" })).toBe("Bank → Cash");
    expect(transferRoute({ from: "upi", to: "card" })).toBe("UPI → Credit Card");
  });
  it("validates account ids", () => {
    expect(isTransferAccount("upi")).toBe(true);
    expect(isTransferAccount("UPI")).toBe(false);
    expect(isTransferAccount(undefined)).toBe(false);
  });
});

describe("mergeFeed", () => {
  it("merges both lists newest first, tagging each item", () => {
    const feed = mergeFeed(
      [tx("a", "2026-11-03T10:00:00Z"), tx("b", "2026-11-01T10:00:00Z")],
      [tr("x", "2026-11-02T10:00:00Z"), tr("y", "2026-11-03T12:00:00Z")],
    );
    expect(feed.map((f) => `${f.kind}:${f.item.id}`)).toEqual([
      "transfer:y",
      "transaction:a",
      "transfer:x",
      "transaction:b",
    ]);
  });

  it("sorts even when inputs are unsorted, and keeps transactions first on equal times", () => {
    const at = "2026-11-03T10:00:00Z";
    const feed = mergeFeed([tx("old", "2026-10-01T00:00:00Z"), tx("a", at)], [tr("x", at)]);
    expect(feed.map((f) => f.item.id)).toEqual(["a", "x", "old"]);
  });

  it("handles empty lists and puts invalid dates last", () => {
    expect(mergeFeed([], [])).toEqual([]);
    const feed = mergeFeed([tx("bad", "not a date")], [tr("x", "2026-11-03T10:00:00Z")]);
    expect(feed.map((f) => f.item.id)).toEqual(["x", "bad"]);
  });

  it("latest 5 across both kinds", () => {
    const txs = [1, 3, 5].map((d) => tx(`t${d}`, `2026-11-0${d}T08:00:00Z`));
    const trs = [2, 4, 6].map((d) => tr(`r${d}`, `2026-11-0${d}T08:00:00Z`));
    expect(mergeFeed(txs, trs).slice(0, 5).map((f) => f.item.id)).toEqual(["r6", "t5", "r4", "t3", "r2"]);
  });
});

describe("transferTotals", () => {
  it("counts and sums transfers in [start, end)", () => {
    const start = new Date("2026-11-01T00:00:00+05:30");
    const end = new Date("2026-12-01T00:00:00+05:30");
    const list = [
      tr("in1", "2026-11-01T00:00:00+05:30", { amount: 0.1 }),
      tr("in2", "2026-11-15T09:00:00+05:30", { amount: 0.2 }),
      tr("out", "2026-12-01T00:00:00+05:30", { amount: 999 }),
      tr("before", "2026-10-31T23:59:00+05:30", { amount: 999 }),
    ];
    expect(transferTotals(list, [start, end])).toEqual({ count: 2, amount: 0.3 });
  });
});
