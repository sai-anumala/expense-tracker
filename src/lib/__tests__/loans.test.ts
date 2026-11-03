import { describe, expect, it } from "vitest";
import { loanCashEvents, loanStatus, loanTotals, nextPaymentDate } from "../loans";
import { iso, loan, local, payment } from "./fixtures";

const NOW = local(2026, 11, 3, 12); // Tue 3 Nov 2026

describe("loanStatus", () => {
  it("open loan with partial repayments", () => {
    const l = loan({
      direction: "lent",
      amount: 10_000,
      totalDue: 12_000,
      date: iso(2026, 9, 1),
      payments: [payment(3000, iso(2026, 10, 1)), payment(1500.5, iso(2026, 10, 15))],
    });
    const s = loanStatus(l, NOW);
    expect(s).toMatchObject({ paid: 4500.5, outstanding: 7499.5, settled: false, overdue: false, nextPayment: null });
    expect(s.progress).toBeCloseTo(4500.5 / 12_000);
  });

  it("settled when payments reach totalDue (float sums are rounded to paise)", () => {
    const l = loan({ direction: "borrowed", amount: 0.3, date: iso(2026, 10, 1), payments: [payment(0.1, iso(2026, 10, 2)), payment(0.2, iso(2026, 10, 3))] });
    expect(loanStatus(l, NOW)).toMatchObject({ paid: 0.3, outstanding: 0, settled: true, progress: 1 });
  });

  it("over-repayment never makes outstanding negative and caps progress at 1", () => {
    const l = loan({ direction: "lent", amount: 100, date: iso(2026, 10, 1), payments: [payment(150, iso(2026, 10, 2))] });
    expect(loanStatus(l, NOW)).toMatchObject({ outstanding: 0, settled: true, progress: 1 });
  });

  it("no repayments → progress 0", () => {
    expect(loanStatus(loan({ direction: "lent", amount: 500, date: iso(2026, 10, 1) }), NOW)).toMatchObject({
      paid: 0,
      outstanding: 500,
      progress: 0,
      settled: false,
    });
  });

  it("overdue only when not settled and the due date is before today", () => {
    const base = { direction: "lent" as const, amount: 1000, date: iso(2026, 10, 1) };
    expect(loanStatus(loan({ ...base, dueDate: iso(2026, 11, 2, 23, 59, 59) }), NOW).overdue).toBe(true);
    // Due today (end of day, as the form stores it) → not overdue yet.
    expect(loanStatus(loan({ ...base, dueDate: iso(2026, 11, 3, 23, 59, 59) }), NOW).overdue).toBe(false);
    expect(loanStatus(loan({ ...base }), NOW).overdue).toBe(false);
    const settled = loan({ ...base, dueDate: iso(2026, 10, 15), payments: [payment(1000, iso(2026, 10, 10))] });
    expect(loanStatus(settled, NOW)).toMatchObject({ settled: true, overdue: false, nextPayment: null });
  });

  it("exposes nextPayment for open loans with a plan", () => {
    const l = loan({ direction: "borrowed", amount: 6000, date: iso(2026, 9, 1), monthlyPayment: 1000, paymentDay: 10 });
    expect(loanStatus(l, NOW).nextPayment).toEqual(local(2026, 11, 10));
  });
});

describe("nextPaymentDate", () => {
  const plan = (paymentDay: number, date = iso(2026, 9, 1)) =>
    loan({ direction: "borrowed", amount: 6000, date, monthlyPayment: 1000, paymentDay });

  it("null without a complete plan", () => {
    expect(nextPaymentDate(loan({ direction: "borrowed", amount: 1, date: iso(2026, 9, 1) }), NOW)).toBeNull();
    expect(nextPaymentDate(loan({ direction: "borrowed", amount: 1, date: iso(2026, 9, 1), monthlyPayment: 1 }), NOW)).toBeNull();
    expect(nextPaymentDate(loan({ direction: "borrowed", amount: 1, date: iso(2026, 9, 1), paymentDay: 5 }), NOW)).toBeNull();
  });

  it("later this month when the day hasn't passed", () => {
    expect(nextPaymentDate(plan(28), NOW)).toEqual(local(2026, 11, 28));
  });

  it("today counts as on/after today", () => {
    expect(nextPaymentDate(plan(3), NOW)).toEqual(local(2026, 11, 3));
  });

  it("rolls to next month when the day has passed, including over the year end", () => {
    expect(nextPaymentDate(plan(1), NOW)).toEqual(local(2026, 12, 1));
    expect(nextPaymentDate(plan(10), local(2026, 12, 15))).toEqual(local(2027, 1, 10));
  });

  it("is never on or before the loan date", () => {
    // Loan taken on the 3rd: the first instalment can't be the same day.
    expect(nextPaymentDate(plan(3, iso(2026, 11, 3, 9)), NOW)).toEqual(local(2026, 12, 3));
    // Loan dated later than today (e.g. clock skew) → first plan day after it.
    expect(nextPaymentDate(plan(5, iso(2026, 11, 20)), NOW)).toEqual(local(2026, 12, 5));
  });
});

describe("loanCashEvents", () => {
  it("signs: lent −, repayment received +, borrowed +, repayment made −", () => {
    const lent = loan({ direction: "lent", amount: 1000, date: iso(2026, 10, 1), payments: [payment(400, iso(2026, 10, 5))] });
    const borrowed = loan({ direction: "borrowed", amount: 5000, totalDue: 5500, date: iso(2026, 10, 2), payments: [payment(500, iso(2026, 10, 6))] });
    expect(loanCashEvents([lent, borrowed])).toEqual([
      { amount: -1000, date: iso(2026, 10, 1) },
      { amount: 400, date: iso(2026, 10, 5) },
      { amount: 5000, date: iso(2026, 10, 2) },
      { amount: -500, date: iso(2026, 10, 6) },
    ]);
  });

  it("uses the principal (amount), not totalDue, for the initial movement", () => {
    const l = loan({ direction: "borrowed", amount: 1000, totalDue: 1200, date: iso(2026, 10, 1) });
    expect(loanCashEvents([l])).toEqual([{ amount: 1000, date: iso(2026, 10, 1) }]);
  });

  it("empty list → no events", () => {
    expect(loanCashEvents([])).toEqual([]);
  });
});

describe("loanTotals", () => {
  it("sums outstanding of open loans per direction and skips settled ones", () => {
    const loans = [
      loan({ direction: "lent", amount: 1000, date: iso(2026, 10, 1), payments: [payment(250.1, iso(2026, 10, 2))] }),
      loan({ direction: "lent", amount: 300.2, date: iso(2026, 10, 1) }),
      loan({ direction: "lent", amount: 50, date: iso(2026, 10, 1), payments: [payment(50, iso(2026, 10, 2))] }), // settled
      loan({ direction: "borrowed", amount: 2000, totalDue: 2400, date: iso(2026, 10, 1), payments: [payment(400, iso(2026, 10, 2))] }),
    ];
    expect(loanTotals(loans, NOW)).toEqual({ toReceive: 1050.1, toPay: 2000, lentOpen: 2, borrowedOpen: 1 });
  });

  it("all zero for no loans", () => {
    expect(loanTotals([], NOW)).toEqual({ toReceive: 0, toPay: 0, lentOpen: 0, borrowedOpen: 0 });
  });
});
