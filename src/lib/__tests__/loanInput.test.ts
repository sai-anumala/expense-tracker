import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AMOUNT } from "../api";
import { parseLoanInput, parsePaymentInput } from "../loanInput";

const NOW = new Date("2026-11-03T06:30:00.000Z"); // 12:00 IST
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

const valid = { direction: "lent", person: "Ravi", source: "friend", amount: 5000, date: "2026-11-01T04:30:00.000Z" };
const parse = (over: Record<string, unknown> = {}) => parseLoanInput({ ...valid, ...over });
const errorOf = (over: Record<string, unknown>) => {
  const r = parse(over);
  return r.ok ? null : r.error;
};

describe("parseLoanInput", () => {
  it("accepts a minimal loan; totalDue defaults to amount; optionals undefined", () => {
    expect(parse()).toEqual({
      ok: true,
      value: {
        direction: "lent",
        person: "Ravi",
        source: "friend",
        amount: 5000,
        totalDue: 5000,
        date: new Date(valid.date),
        dueDate: undefined,
        monthlyPayment: undefined,
        paymentDay: undefined,
        account: undefined,
        note: undefined,
      },
    });
  });

  it("direction and source must be known values", () => {
    expect(errorOf({ direction: "gift" })).toBe("Choose whether you lent or borrowed.");
    expect(errorOf({ source: "loan-shark" })).toBe("Choose a source (friend, relative, online app, bank, other).");
  });

  it("person is required (message depends on direction), whitespace collapsed, ≤ 60", () => {
    expect(errorOf({ person: "  " })).toBe("Who did you lend to?");
    expect(errorOf({ direction: "borrowed", person: "" })).toBe("Who did you borrow from?");
    const r = parse({ person: "  Ravi    Kumar " });
    expect(r.ok && r.value.person).toBe("Ravi Kumar");
    expect(parse({ person: "p".repeat(60) }).ok).toBe(true);
    expect(errorOf({ person: "p".repeat(61) })).toBe("Name must be 60 characters or fewer.");
  });

  it("amount must be > 0, ≤ MAX_AMOUNT, rounded to paise", () => {
    expect(errorOf({ amount: 0 })).toBe("Amount must be more than 0.");
    expect(errorOf({ amount: -5 })).toBe("Amount must be more than 0.");
    expect(errorOf({ amount: "abc" })).toBe("Amount must be more than 0.");
    expect(errorOf({ amount: MAX_AMOUNT + 1 })).toBe("Amount is too large.");
    const r = parse({ amount: "99.999" });
    expect(r.ok && r.value.amount).toBe(100);
  });

  it("totalDue ≥ amount (interest/fees); blank/null means 'same as amount'", () => {
    const r = parse({ totalDue: 5500 });
    expect(r.ok && r.value.totalDue).toBe(5500);
    expect(parse({ totalDue: 5000 }).ok).toBe(true);
    expect(errorOf({ totalDue: 4999.99 })).toBe("Total to repay can't be less than the amount.");
    expect(errorOf({ totalDue: 0 })).toBe("Total to repay must be more than 0.");
    for (const totalDue of ["", null, undefined]) {
      const r2 = parse({ totalDue });
      expect(r2.ok && r2.value.totalDue).toBe(5000);
    }
  });

  it("date required and not in the future (5 min tolerance)", () => {
    expect(errorOf({ date: undefined })).toBe("Invalid Date.");
    expect(errorOf({ date: "" })).toBe("Invalid Date.");
    expect(errorOf({ date: "nope" })).toBe("Invalid Date.");
    expect(parse({ date: new Date(NOW.getTime() + 5 * 60_000).toISOString() }).ok).toBe(true);
    expect(errorOf({ date: new Date(NOW.getTime() + 6 * 60_000).toISOString() })).toBe("Date can't be in the future.");
  });

  it("due date may be in the future but not before the loan date", () => {
    const r = parse({ dueDate: "2027-03-31T18:29:59.000Z" });
    expect(r.ok && r.value.dueDate).toEqual(new Date("2027-03-31T18:29:59.000Z"));
    expect(parse({ dueDate: valid.date }).ok).toBe(true);
    expect(errorOf({ dueDate: "2026-10-31T00:00:00.000Z" })).toBe("Due date can't be before the loan date.");
    expect(errorOf({ dueDate: "soon" })).toBe("Invalid Due date.");
  });

  it("monthly plan needs a payment day between 1 and 28 and ≤ totalDue", () => {
    const r = parse({ monthlyPayment: 1000, paymentDay: 5 });
    expect(r.ok && [r.value.monthlyPayment, r.value.paymentDay]).toEqual([1000, 5]);
    expect(parse({ monthlyPayment: 1000, paymentDay: "28" }).ok).toBe(true);
    for (const paymentDay of [undefined, 0, 29, 31, 2.5, "x"]) {
      expect(errorOf({ monthlyPayment: 1000, paymentDay })).toBe("Payment day must be between 1 and 28.");
    }
    expect(errorOf({ monthlyPayment: 5000.01, paymentDay: 5 })).toBe("Monthly payment can't be more than the total to repay.");
    expect(parse({ totalDue: 6000, monthlyPayment: 6000, paymentDay: 5 }).ok).toBe(true);
    expect(errorOf({ monthlyPayment: 0, paymentDay: 5 })).toBe("Monthly payment must be more than 0.");
  });

  it("payment day without a monthly amount is dropped", () => {
    const r = parse({ paymentDay: 5 });
    expect(r.ok && r.value.paymentDay).toBeUndefined();
  });

  it("account ≤ 80 and note ≤ 200, blanks → undefined", () => {
    expect(errorOf({ account: "a".repeat(81) })).toBe("Payment method name is too long.");
    expect(errorOf({ note: "n".repeat(201) })).toBe("Note must be 200 characters or fewer.");
    const r = parse({ account: "  ", note: " hi " });
    expect(r.ok && [r.value.account, r.value.note]).toEqual([undefined, "hi"]);
  });
});

describe("parsePaymentInput", () => {
  const ok = { amount: 500, date: "2026-11-02T04:30:00.000Z" };

  it("accepts a valid repayment", () => {
    expect(parsePaymentInput({ ...ok, account: " Cash ", note: "" })).toEqual({
      ok: true,
      value: { amount: 500, date: new Date(ok.date), account: "Cash", note: undefined },
    });
  });

  it("amount must be > 0 and ≤ MAX_AMOUNT", () => {
    expect(parsePaymentInput({ ...ok, amount: 0 })).toEqual({ ok: false, error: "Payment amount must be more than 0." });
    expect(parsePaymentInput({ ...ok, amount: MAX_AMOUNT + 1 })).toEqual({ ok: false, error: "Payment amount is too large." });
  });

  it("date required and not in the future", () => {
    expect(parsePaymentInput({ amount: 1 })).toEqual({ ok: false, error: "Invalid Payment date." });
    expect(parsePaymentInput({ amount: 1, date: "2026-11-04T00:00:00.000Z" })).toEqual({
      ok: false,
      error: "Payment date can't be in the future.",
    });
  });

  it("account and note length limits", () => {
    expect(parsePaymentInput({ ...ok, account: "a".repeat(81) })).toEqual({ ok: false, error: "Payment method name is too long." });
    expect(parsePaymentInput({ ...ok, note: "n".repeat(201) })).toEqual({ ok: false, error: "Note must be 200 characters or fewer." });
  });
});
