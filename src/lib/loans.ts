// Loans (lend & borrow): shared types and pure calculations. Safe for client and server.

export const LOAN_DIRECTIONS = ["lent", "borrowed"] as const;
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number];

export const LOAN_SOURCES = ["friend", "relative", "online", "bank", "other"] as const;
export type LoanSource = (typeof LOAN_SOURCES)[number];

export const loanSourceLabels: Record<LoanSource, string> = {
  friend: "Friend",
  relative: "Relative",
  online: "Online app",
  bank: "Bank",
  other: "Other",
};

export type LoanPayment = {
  id: string;
  amount: number; // always > 0
  date: string; // ISO
  account?: string;
  note?: string;
};

export type Loan = {
  id: string;
  /** "lent" = they owe me; "borrowed" = I owe them. */
  direction: LoanDirection;
  person: string;
  source: LoanSource;
  /** Principal that changed hands on `date` (> 0). */
  amount: number;
  /** What must be repaid in total (≥ amount; > amount when there is interest/fees). */
  totalDue: number;
  date: string; // ISO
  dueDate?: string; // ISO, optional "repay by"
  monthlyPayment?: number; // optional plan
  paymentDay?: number; // 1–28, day of month for the plan
  account?: string;
  note?: string;
  payments: LoanPayment[];
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Paid, outstanding, progress and status for one loan. */
export function loanStatus(loan: Loan, now = new Date()) {
  const paid = round(loan.payments.reduce((s, p) => s + p.amount, 0));
  const outstanding = Math.max(0, round(loan.totalDue - paid));
  const settled = outstanding <= 0;
  const progress = loan.totalDue > 0 ? Math.min(1, paid / loan.totalDue) : 1;
  const overdue = !settled && !!loan.dueDate && new Date(loan.dueDate) < startOfDay(now);
  return { paid, outstanding, settled, progress, overdue, nextPayment: settled ? null : nextPaymentDate(loan, now) };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Next date of the monthly plan on/after today (null if no plan). */
export function nextPaymentDate(loan: Loan, now = new Date()): Date | null {
  if (!loan.monthlyPayment || !loan.paymentDay) return null;
  const today = startOfDay(now);
  let d = new Date(today.getFullYear(), today.getMonth(), loan.paymentDay);
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, loan.paymentDay);
  // Not before the loan started.
  const start = startOfDay(new Date(loan.date));
  while (d <= start) d = new Date(d.getFullYear(), d.getMonth() + 1, loan.paymentDay);
  return d;
}

/**
 * Cash movements caused by loans, signed from the user's point of view
 * (+ money in, − money out). Used for Total Available Balance; never counted as income or spending.
 */
export function loanCashEvents(loans: Loan[]): { amount: number; date: string }[] {
  const events: { amount: number; date: string }[] = [];
  for (const l of loans) {
    const sign = l.direction === "lent" ? 1 : -1; // lending = money out now, back in later
    events.push({ amount: -sign * l.amount, date: l.date });
    for (const p of l.payments) events.push({ amount: sign * p.amount, date: p.date });
  }
  return events;
}

/** Totals for the summary cards. */
export function loanTotals(loans: Loan[], now = new Date()) {
  let toReceive = 0;
  let toPay = 0;
  let lentOpen = 0;
  let borrowedOpen = 0;
  for (const l of loans) {
    const { outstanding, settled } = loanStatus(l, now);
    if (settled) continue;
    if (l.direction === "lent") {
      toReceive += outstanding;
      lentOpen++;
    } else {
      toPay += outstanding;
      borrowedOpen++;
    }
  }
  return { toReceive: round(toReceive), toPay: round(toPay), lentOpen, borrowedOpen };
}
