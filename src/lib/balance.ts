// Available-balance helpers for low-balance warnings (client-safe, pure).
import type { Settings, Transaction } from "./data";
import { availableCashEvents } from "./creditCard";
import { anchoredBalance } from "./insights";
import type { Loan } from "./loans";
import type { Transfer } from "./transfers";

/**
 * Current Total Available Balance (Bank + UPI + Cash under the card model, see lib/creditCard.ts), optionally
 * ignoring one transaction, transfer or loan (the one being edited, so its old amount isn't counted twice).
 * Returns null when the user hasn't entered a balance yet.
 */
export function availableBalance(
  transactions: Transaction[],
  transfers: Transfer[],
  loans: Loan[],
  settings: Settings,
  exclude: { transactionId?: string; transferId?: string; loanId?: string } = {},
): number | null {
  if (settings.openingBalance === null || !settings.balanceAsOf) return null;
  const tx = exclude.transactionId ? transactions.filter((t) => t.id !== exclude.transactionId) : transactions;
  const tr = exclude.transferId ? transfers.filter((t) => t.id !== exclude.transferId) : transfers;
  const ln = exclude.loanId ? loans.filter((l) => l.id !== exclude.loanId) : loans;
  return anchoredBalance(availableCashEvents(tx, tr, ln), settings.openingBalance, settings.balanceAsOf, new Date(0))
    .balance;
}

/**
 * Should money going OUT (cash expense, lending, repaying a borrowed loan, paying the card bill) trigger a
 * low-balance warning? Only when a balance is set, the outflow is dated at/after the balance anchor (earlier dates
 * don't change the balance by design), and it is larger than what's available. Card purchases pass outflow 0.
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

/**
 * Budget still left this month that the available balance can't cover, or null. Compares what's left, not the whole
 * limit: money already spent this month has already left the balance.
 */
export function budgetAboveBalance(limit: number, spent: number, available: number | null): number | null {
  if (limit <= 0 || available === null) return null;
  const left = Math.round((limit - spent) * 100) / 100;
  return left > 0 && left > available ? left : null;
}
