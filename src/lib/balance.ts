// Available-balance helpers for low-balance warnings (client-safe, pure).
import type { Settings, Transaction } from "./data";
import { anchoredBalance } from "./insights";
import { loanCashEvents, type Loan } from "./loans";

/**
 * Current Total Available Balance, optionally ignoring one transaction or loan (the one being edited,
 * so its old amount isn't counted twice). Returns null when the user hasn't entered a balance yet.
 */
export function availableBalance(
  transactions: Transaction[],
  loans: Loan[],
  settings: Settings,
  exclude: { transactionId?: string; loanId?: string } = {},
): number | null {
  if (settings.openingBalance === null || !settings.balanceAsOf) return null;
  const tx = exclude.transactionId ? transactions.filter((t) => t.id !== exclude.transactionId) : transactions;
  const ln = exclude.loanId ? loans.filter((l) => l.id !== exclude.loanId) : loans;
  return anchoredBalance([...tx, ...loanCashEvents(ln)], settings.openingBalance, settings.balanceAsOf, new Date(0)).balance;
}

/**
 * Should money going OUT (expense, lending, repaying a borrowed loan) trigger a low-balance warning?
 * Only when a balance is set, the outflow is dated at/after the balance anchor (earlier dates don't change
 * the balance by design), and it is larger than what's available.
 */
export function shortfall(
  available: number | null,
  outflow: number,
  date: Date,
  balanceAsOf: string | null,
): { available: number; after: number } | null {
  if (available === null || !balanceAsOf || outflow <= 0) return null;
  if (date < new Date(balanceAsOf)) return null;
  const after = Math.round((available - outflow) * 100) / 100;
  return after < 0 ? { available, after } : null;
}
