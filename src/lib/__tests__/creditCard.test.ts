import { describe, expect, it } from "vitest";
import { anchoredBalance } from "../insights";
import {
  availableCashEvents,
  cardDueEvents,
  cardSummary,
  currentCardDue,
  dueDateFor,
  expenseCashOutflow,
  lastStatementEnd,
  needsCardDuePrompt,
  transferCashEffect,
  type CardSettings,
} from "../creditCard";
import type { Transfer } from "../transfers";
import { iso, local, tx } from "./fixtures";

let n = 0;
const transfer = (from: Transfer["from"], to: Transfer["to"], amount: number, date: string): Transfer => ({ id: `tr${++n}`, from, to, amount, date });
const card = (amount: number, date: string, category: "food" | "shopping" = "food") => tx(amount, date, { account: "Credit Card", category });
const upi = (amount: number, date: string) => tx(amount, date, { account: "UPI" });

const CARD: CardSettings = { statementDay: 15, dueDay: 5, limit: 50000 };
const anchorIso = iso(2026, 10, 1, 9);
const balanceOf = (txs: ReturnType<typeof tx>[], trs: Transfer[], entered = 50000) =>
  anchoredBalance(availableCashEvents(txs, trs, []), entered, anchorIso, local(2026, 10, 1)).balance;

describe("available balance under the card model", () => {
  it("card purchases do NOT reduce the available balance; UPI purchases do", () => {
    expect(balanceOf([card(-100, iso(2026, 10, 2)), upi(-200, iso(2026, 10, 2))], [])).toBe(49800);
  });
  it("paying the card bill reduces the available balance (cash leaves)", () => {
    expect(balanceOf([card(-3000, iso(2026, 10, 10))], [transfer("bank", "card", 3000, iso(2026, 11, 5))])).toBe(47000);
  });
  it("cash withdrawal from the card adds cash", () => {
    expect(balanceOf([], [transfer("card", "cash", 2000, iso(2026, 10, 3))])).toBe(52000);
  });
  it("transfers between bank/UPI/cash are neutral", () => {
    expect(balanceOf([], [transfer("bank", "cash", 5000, iso(2026, 10, 3)), transfer("upi", "bank", 100, iso(2026, 10, 4))])).toBe(50000);
  });
  it("refund to the card does not change available cash", () => {
    expect(balanceOf([card(40, iso(2026, 10, 3))], [])).toBe(50000);
  });
});

describe("card due events", () => {
  it("purchase +, refund −, payment −, advance +", () => {
    const ev = cardDueEvents(
      [card(-100, iso(2026, 10, 2)), card(40, iso(2026, 10, 3)), upi(-500, iso(2026, 10, 3))],
      [transfer("bank", "card", 60, iso(2026, 10, 4)), transfer("card", "cash", 200, iso(2026, 10, 5)), transfer("bank", "cash", 1, iso(2026, 10, 5))],
    );
    expect(ev.map((e) => [e.kind, e.amount])).toEqual([
      ["purchase", 100],
      ["refund", -40],
      ["payment", -60],
      ["advance", 200],
    ]);
  });
});

describe("statement cycle dates", () => {
  it("last statement = end of statement day on/before now", () => {
    expect(lastStatementEnd(15, local(2026, 11, 3))).toEqual(new Date(2026, 9, 15, 23, 59, 59, 999));
    expect(lastStatementEnd(15, local(2026, 11, 20))).toEqual(new Date(2026, 10, 15, 23, 59, 59, 999));
  });
  it("due day ≤ statement day falls in the next month; > statement day in the same month", () => {
    expect(dueDateFor(new Date(2026, 9, 15, 23, 59, 59), { statementDay: 15, dueDay: 5 })).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999));
    expect(dueDateFor(new Date(2026, 9, 1, 23, 59, 59), { statementDay: 1, dueDay: 20 })).toEqual(new Date(2026, 9, 20, 23, 59, 59, 999));
  });
});

describe("card summary (statement 15th, due 5th)", () => {
  const settings = { balanceAsOf: anchorIso, cardDueAtAnchor: 0 };
  const txs = [card(-2000, iso(2026, 10, 10), "shopping"), card(-1000, iso(2026, 10, 12)), card(-450, iso(2026, 10, 28))];

  it("splits billed (≤ 15 Oct) and unbilled (after) amounts; due date 5 Nov", () => {
    const s = cardSummary(txs, [], CARD, settings, local(2026, 11, 3, 12));
    expect([s.due, s.billed, s.billOutstanding, s.unbilled]).toEqual([3450, 3000, 3000, 450]);
    expect(s.dueDate).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999));
    expect(s.daysToDue).toBe(2);
    expect(s.overdue).toBe(false);
    expect(s.utilization).toBeCloseTo(3450 / 50000);
    expect(s.unbilledEvents).toHaveLength(1);
    expect(s.billedEvents).toHaveLength(2);
  });
  it("partial bill payment leaves the rest outstanding; full payment clears it", () => {
    const partial = cardSummary(txs, [transfer("bank", "card", 1000, iso(2026, 11, 1))], CARD, settings, local(2026, 11, 3));
    expect([partial.billOutstanding, partial.unbilled, partial.due]).toEqual([2000, 450, 2450]);
    const full = cardSummary(txs, [transfer("bank", "card", 3000, iso(2026, 11, 1))], CARD, settings, local(2026, 11, 3));
    expect([full.billOutstanding, full.unbilled, full.due]).toEqual([0, 450, 450]);
  });
  it("overdue after the due date with an unpaid bill", () => {
    const s = cardSummary(txs, [], CARD, settings, local(2026, 11, 7));
    expect(s.overdue).toBe(true);
    expect(s.daysToDue).toBe(-2);
  });
  it("overpaying shows card credit", () => {
    const s = cardSummary(txs, [transfer("bank", "card", 4000, iso(2026, 11, 1))], CARD, settings, local(2026, 11, 3));
    expect([s.due, s.credit, s.billOutstanding, s.unbilled]).toEqual([-550, 550, 0, 0]);
  });
  it("unpaid amount entered with the balance (anchor after the statement) is the bill; then paid by transfer", () => {
    // The gap case: user enters bank balance on 1 Nov while ₹3,000 is unpaid on the card.
    const s = { balanceAsOf: iso(2026, 11, 1, 9), cardDueAtAnchor: 3000 };
    const before = cardSummary([card(-3000, iso(2026, 10, 10))], [], CARD, s, local(2026, 11, 3));
    expect([before.due, before.billOutstanding]).toEqual([3000, 3000]); // pre-anchor purchase not double counted
    const paid = [transfer("bank", "card", 3000, iso(2026, 11, 4))];
    const after = cardSummary([card(-3000, iso(2026, 10, 10))], paid, CARD, s, local(2026, 11, 5));
    expect([after.due, after.billOutstanding]).toEqual([0, 0]);
    const bal = anchoredBalance(availableCashEvents([card(-3000, iso(2026, 10, 10))], paid, []), 50000, s.balanceAsOf, local(2026, 11, 1)).balance;
    expect(bal).toBe(47000); // bank really has 47,000 after paying
  });
  it("no limit → utilization null; no anchor → counts all events from 0", () => {
    const s = cardSummary(txs, [], { statementDay: 15, dueDay: 5 }, { balanceAsOf: null }, local(2026, 11, 3));
    expect(s.utilization).toBeNull();
    expect(s.due).toBe(3450);
  });
});

describe("small card helpers", () => {
  it("transferCashEffect: bill −, withdrawal +, others 0", () => {
    expect(transferCashEffect({ from: "upi", to: "card", amount: 500 })).toBe(-500);
    expect(transferCashEffect({ from: "card", to: "cash", amount: 300 })).toBe(300);
    expect(transferCashEffect({ from: "bank", to: "cash", amount: 100 })).toBe(0);
  });
  it("expenseCashOutflow: card purchases take no cash", () => {
    expect(expenseCashOutflow(800, "Credit Card")).toBe(0);
    expect(expenseCashOutflow(800, "UPI")).toBe(800);
    expect(expenseCashOutflow(800, undefined)).toBe(800);
  });
  it("currentCardDue = entered unpaid amount + card events since the anchor", () => {
    const s = { balanceAsOf: iso(2026, 11, 1, 9), cardDueAtAnchor: 1200 };
    const txs = [card(-999, iso(2026, 10, 30)), card(-300, iso(2026, 11, 2)), card(50, iso(2026, 11, 2))];
    expect(currentCardDue(txs, [transfer("bank", "card", 1000, iso(2026, 11, 3))], s)).toBe(450);
    expect(currentCardDue(txs, [], { balanceAsOf: null })).toBe(1249);
  });
  it("needsCardDuePrompt only for a legacy balance (cardDueAtAnchor null) with card activity since it", () => {
    const base = { openingBalance: 5000, balanceAsOf: iso(2026, 11, 1, 9), cardDueAtAnchor: null };
    const after = [card(-100, iso(2026, 11, 2))];
    expect(needsCardDuePrompt(after, [], base)).toBe(true);
    expect(needsCardDuePrompt([card(-100, iso(2026, 10, 2))], [], base)).toBe(false); // before the anchor
    expect(needsCardDuePrompt([upi(-100, iso(2026, 11, 2))], [], base)).toBe(false);
    expect(needsCardDuePrompt([], [transfer("bank", "card", 10, iso(2026, 11, 2))], base)).toBe(true);
    expect(needsCardDuePrompt(after, [], { ...base, cardDueAtAnchor: 0 })).toBe(false);
    expect(needsCardDuePrompt(after, [], { ...base, openingBalance: null })).toBe(false);
  });
});
