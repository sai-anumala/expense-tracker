import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAlerts, isAttention, type AlertInput } from "../alerts";
import type { CardSettings } from "../creditCard";
import { emptyBudget, type Budget, type Settings } from "../data";
import { money } from "../format";
import type { Transfer } from "../transfers";
import { iso, loan, local, payment, tx } from "./fixtures";

const CARD: CardSettings = { statementDay: 15, dueDay: 5, limit: 50000 };
const anchored: Settings = { openingBalance: 10000, balanceAsOf: iso(2026, 10, 1, 9), cardDueAtAnchor: 0, card: CARD };
const noCard: Settings = { ...anchored, card: null };
const cardTx = (amount: number, date: string) => tx(amount, date, { account: "Credit Card" });
const bill = (amount: number, date: string): Transfer => ({ id: `bill-${date}`, from: "bank", to: "card", amount, date });

function run(over: Partial<AlertInput> = {}) {
  return buildAlerts({ transactions: [], transfers: [], loans: [], budget: emptyBudget, settings: noCard, ...over });
}
const at = (y: number, m: number, d: number, h = 10) => vi.setSystemTime(local(y, m, d, h));

beforeEach(() => {
  vi.useFakeTimers();
  at(2026, 11, 2);
});
afterEach(() => vi.useRealTimers());

describe("empty / nothing to remind", () => {
  it("no data → no alerts", () => {
    expect(run()).toEqual([]);
  });
  it("card purchases are ignored when no card is set up (null or missing at runtime)", () => {
    const transactions = [cardTx(-45000, iso(2026, 10, 10))];
    expect(run({ transactions, settings: noCard })).toEqual([]);
    const { card: _omit, ...withoutCard } = anchored;
    void _omit;
    expect(run({ transactions, settings: withoutCard })).toEqual([]);
  });
});

describe("card bill", () => {
  // Statement closes 15 Oct; bill due 5 Nov.
  const transactions = [cardTx(-3000, iso(2026, 10, 10))];

  it("warns when the bill is due within 5 days", () => {
    const [a] = run({ transactions, settings: anchored });
    expect(a).toMatchObject({ id: "card:bill", severity: "warning", href: "/card", icon: "card" });
    expect(a.title).toBe(`Card bill ${money(3000)} due in 3 days`);
  });
  it("says 'tomorrow' and 'today'", () => {
    at(2026, 11, 4);
    expect(run({ transactions, settings: anchored })[0].title).toBe(`Card bill ${money(3000)} due tomorrow`);
    at(2026, 11, 5, 20);
    expect(run({ transactions, settings: anchored })[0].title).toBe(`Card bill ${money(3000)} due today`);
  });
  it("is silent more than 5 days before the due date", () => {
    at(2026, 10, 30);
    expect(run({ transactions, settings: anchored })).toEqual([]);
  });
  it("is urgent once overdue", () => {
    at(2026, 11, 6);
    const [a] = run({ transactions, settings: anchored });
    expect(a).toMatchObject({ id: "card:bill", severity: "urgent", title: `Card bill ${money(3000)} overdue` });
  });
  it("disappears once the bill is paid; a partial payment leaves the rest", () => {
    expect(run({ transactions, transfers: [bill(3000, iso(2026, 11, 1))], settings: anchored })).toEqual([]);
    expect(run({ transactions, transfers: [bill(1000, iso(2026, 11, 1))], settings: anchored })[0].title).toBe(
      `Card bill ${money(2000)} due in 3 days`,
    );
  });
  it("unbilled purchases (after the statement) don't trigger a bill reminder", () => {
    expect(run({ transactions: [cardTx(-3000, iso(2026, 10, 20))], settings: anchored })).toEqual([]);
  });
});

describe("card utilisation", () => {
  it("warns at ≥ 80% of the limit", () => {
    const a = run({ transactions: [cardTx(-41000, iso(2026, 10, 20))], settings: anchored });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: "card:utilization", severity: "warning", title: "Card usage 82% of limit" });
  });
  it("is silent below 80% or without a limit", () => {
    expect(run({ transactions: [cardTx(-39999, iso(2026, 10, 20))], settings: anchored })).toEqual([]);
    const noLimit = { ...anchored, card: { statementDay: 15, dueDay: 5 } };
    expect(run({ transactions: [cardTx(-49000, iso(2026, 10, 20))], settings: noLimit })).toEqual([]);
  });
});

describe("loans", () => {
  it("overdue borrowed / lent loans are urgent with the right wording", () => {
    const b = loan({ direction: "borrowed", amount: 5000, date: iso(2026, 9, 1), dueDate: iso(2026, 10, 30, 23), person: "HDFC" });
    const l = loan({ direction: "lent", amount: 2000, date: iso(2026, 9, 1), dueDate: iso(2026, 10, 31, 23), person: "Ravi" });
    const out = run({ loans: [l, b] });
    expect(out.map((a) => a.title)).toEqual(["Loan from HDFC overdue", "Loan to Ravi overdue"]); // earlier due date first
    expect(out[0]).toMatchObject({ id: `loan:${b.id}:overdue`, severity: "urgent", href: `/loans/${b.id}`, icon: "loan" });
  });
  it("settled loans are ignored", () => {
    const l = loan({ direction: "lent", amount: 2000, date: iso(2026, 9, 1), dueDate: iso(2026, 10, 1), payments: [payment(2000, iso(2026, 9, 20))] });
    expect(run({ loans: [l] })).toEqual([]);
  });
  it("next monthly payment within 3 days: Pay (borrowed) / Collect (lent), capped at outstanding", () => {
    const b = loan({ direction: "borrowed", amount: 12000, date: iso(2026, 8, 1), monthlyPayment: 2000, paymentDay: 4, person: "Bajaj" });
    const l = loan({
      direction: "lent",
      amount: 3000,
      date: iso(2026, 8, 1),
      monthlyPayment: 1000,
      paymentDay: 2,
      person: "Asha",
      payments: [payment(2500, iso(2026, 10, 2))],
    });
    const out = run({ loans: [b, l] });
    expect(out.map((a) => a.title)).toEqual([`Collect ${money(500)} from Asha today`, `Pay ${money(2000)} to Bajaj on 4 Nov`]);
    expect(out.every((a) => a.severity === "warning")).toBe(true);
    at(2026, 11, 3);
    expect(run({ loans: [b] })[0].title).toBe(`Pay ${money(2000)} to Bajaj tomorrow`);
  });
  it("is silent when the next payment is more than 3 days away", () => {
    const b = loan({ direction: "borrowed", amount: 12000, date: iso(2026, 8, 1), monthlyPayment: 2000, paymentDay: 6 });
    expect(run({ loans: [b] })).toEqual([]);
  });
  it("an overdue loan with a plan shows only the overdue alert", () => {
    const b = loan({ direction: "borrowed", amount: 12000, date: iso(2026, 8, 1), dueDate: iso(2026, 10, 1), monthlyPayment: 2000, paymentDay: 3 });
    const out = run({ loans: [b] });
    expect(out.map((a) => a.id)).toEqual([`loan:${b.id}:overdue`]);
  });
});

describe("budgets", () => {
  const budget: Budget = { monthlyLimit: 10000, categories: [{ category: "food", limit: 2000 }] };

  it("no budget set → no alerts even with heavy spending", () => {
    expect(run({ transactions: [tx(-99999, iso(2026, 11, 1))] })).toEqual([]);
  });
  it("monthly budget ≥ 90% → warning; only this month's expenses count", () => {
    const out = run({ budget: { ...budget, categories: [] }, transactions: [tx(-9200, iso(2026, 11, 1)), tx(-5000, iso(2026, 10, 30)), tx(50000, iso(2026, 11, 1))] });
    expect(out).toEqual([expect.objectContaining({ id: "budget:month", severity: "warning", title: "Monthly budget 92% used", href: "/budgets" })]);
  });
  it("below 90% → nothing (89.99% is not rounded up)", () => {
    expect(run({ budget: { ...budget, categories: [] }, transactions: [tx(-8999, iso(2026, 11, 1))] })).toEqual([]);
  });
  it("over the monthly budget → urgent with the amount over; exactly 100% → fully used", () => {
    expect(run({ budget: { ...budget, categories: [] }, transactions: [tx(-10500, iso(2026, 11, 1))] })[0]).toMatchObject({
      severity: "urgent",
      title: `Over monthly budget by ${money(500)}`,
    });
    expect(run({ budget: { ...budget, categories: [] }, transactions: [tx(-10000, iso(2026, 11, 1))] })[0]).toMatchObject({
      severity: "urgent",
      title: "Monthly budget fully used",
    });
  });
  it("category budgets use the long category name", () => {
    const out = run({ budget, transactions: [tx(-1900, iso(2026, 11, 1), { category: "food" }), tx(-100, iso(2026, 11, 1), { category: "fuel" })] });
    expect(out).toEqual([expect.objectContaining({ id: "budget:cat:food", severity: "warning", title: "Food & Dining budget 95% used" })]);
    const over = run({ budget, transactions: [tx(-2300, iso(2026, 11, 1), { category: "food" })] });
    expect(over[0]).toMatchObject({ id: "budget:cat:food", severity: "urgent", title: `Over Food & Dining budget by ${money(300)}` });
  });
});

describe("ordering and ids", () => {
  it("urgent before warning; ids are stable across calls", () => {
    const input: Partial<AlertInput> = {
      settings: anchored,
      transactions: [cardTx(-3000, iso(2026, 10, 10)), tx(-9500, iso(2026, 11, 1))],
      budget: { monthlyLimit: 10000, categories: [] },
      loans: [loan({ direction: "borrowed", amount: 500, date: iso(2026, 9, 1), dueDate: iso(2026, 10, 20) })],
    };
    const out = run(input);
    expect(out.map((a) => a.severity)).toEqual(["urgent", "warning", "warning"]);
    expect(out[0].icon).toBe("loan");
    expect(out.slice(1).map((a) => a.id)).toEqual(["card:bill", "budget:month"]); // earlier date first
    expect(run(input).map((a) => a.id)).toEqual(out.map((a) => a.id));
    expect(out.filter(isAttention)).toHaveLength(3);
  });
});
