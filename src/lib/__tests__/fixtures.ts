// Small builders shared by the unit tests (not a test file itself).
import type { CategoryId, Transaction } from "../data";
import type { Loan, LoanPayment } from "../loans";

/** Local time (TZ is pinned to Asia/Kolkata in vitest.config.mts). Month is 1-based for readability. */
export const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
export const iso = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => local(y, m, d, h, min, s).toISOString();

let seq = 0;

export function tx(amount: number, date: string, over: Partial<Transaction> = {}): Transaction {
  const category: CategoryId = over.category ?? (amount > 0 ? "income" : "food");
  return { id: `t${++seq}`, merchant: over.merchant ?? category, category, amount, date, ...over };
}

export function payment(amount: number, date: string, over: Partial<LoanPayment> = {}): LoanPayment {
  return { id: `p${++seq}`, amount, date, ...over };
}

export function loan(over: Partial<Loan> & Pick<Loan, "direction" | "amount" | "date">): Loan {
  return {
    id: `l${++seq}`,
    person: "Ravi",
    source: "friend",
    totalDue: over.amount,
    payments: [],
    ...over,
  };
}
