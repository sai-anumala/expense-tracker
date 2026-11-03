import { describe, expect, it } from "vitest";
import { availableBalance, shortfall } from "../balance";
import type { Settings } from "../data";
import { iso, loan, local, payment, tx } from "./fixtures";

const asOf = iso(2026, 11, 1, 9);
const settings: Settings = { openingBalance: 10_000, balanceAsOf: asOf };

describe("availableBalance", () => {
  const before = tx(-700, iso(2026, 10, 31)); // before the anchor → ignored
  const coffee = tx(-200, iso(2026, 11, 2), { id: "coffee" });
  const salary = tx(3000, iso(2026, 11, 2), { id: "salary" });
  const lent = loan({ id: "lent", direction: "lent", amount: 1000, date: iso(2026, 11, 2), payments: [payment(400, iso(2026, 11, 3))] });
  const borrowed = loan({ id: "borrowed", direction: "borrowed", amount: 500, date: iso(2026, 11, 2) });

  it("null when no balance has been entered", () => {
    expect(availableBalance([coffee], [], { openingBalance: null, balanceAsOf: null })).toBeNull();
    expect(availableBalance([coffee], [], { openingBalance: 100, balanceAsOf: null })).toBeNull();
  });

  it("entered + transactions + loan cash since the anchor", () => {
    // 10000 − 200 + 3000 − 1000 + 400 + 500
    expect(availableBalance([before, coffee, salary], [lent, borrowed], settings)).toBe(12_700);
  });

  it("anchor in an earlier month still counts everything after it (monthStart is irrelevant)", () => {
    expect(availableBalance([coffee], [], { openingBalance: 1000, balanceAsOf: iso(2026, 1, 1) })).toBe(800);
  });

  it("excludes the transaction being edited", () => {
    expect(availableBalance([coffee, salary], [], settings, { transactionId: "coffee" })).toBe(13_000);
  });

  it("excludes the loan being edited, including its repayments", () => {
    expect(availableBalance([], [lent, borrowed], settings, { loanId: "lent" })).toBe(10_500);
  });

  it("an unknown exclude id changes nothing", () => {
    expect(availableBalance([coffee], [lent], settings, { transactionId: "nope", loanId: "nope" })).toBe(9_200);
  });
});

describe("shortfall", () => {
  const when = local(2026, 11, 3, 12);

  it("null when the outflow fits (including exactly emptying the balance)", () => {
    expect(shortfall(1000, 999.99, when, asOf)).toBeNull();
    expect(shortfall(1000, 1000, when, asOf)).toBeNull();
  });

  it("warns with the negative 'after' amount when the outflow is larger", () => {
    expect(shortfall(1000, 1500.5, when, asOf)).toEqual({ available: 1000, after: -500.5 });
  });

  it("rounds 'after' to paise", () => {
    expect(shortfall(0.3, 0.4, when, asOf)).toEqual({ available: 0.3, after: -0.1 });
  });

  it("warns for any outflow when the balance is already negative", () => {
    expect(shortfall(-200, 1, when, asOf)).toEqual({ available: -200, after: -201 });
  });

  it("only outflows (> 0) warn", () => {
    expect(shortfall(100, 0, when, asOf)).toBeNull();
    expect(shortfall(100, -500, when, asOf)).toBeNull();
  });

  it("no warning without a balance", () => {
    expect(shortfall(null, 500, when, asOf)).toBeNull();
    expect(shortfall(100, 500, when, null)).toBeNull();
  });

  it("only when dated at/after the anchor", () => {
    expect(shortfall(100, 500, local(2026, 11, 1, 8, 59), asOf)).toBeNull();
    expect(shortfall(100, 500, new Date(asOf), asOf)).toEqual({ available: 100, after: -400 });
  });
});
