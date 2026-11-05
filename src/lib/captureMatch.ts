// Client-side helpers for the "To review" list of captured bank alerts. Pure.

import type { CategoryId, Transaction } from "./data";
import type { CapturedKind } from "./bankAlertParser";
import type { Transfer } from "./transfers";

export type CapturedItem = {
  id: string;
  /** Alert with account/card numbers and balances hidden. */
  text: string;
  sender?: string;
  receivedAt: string; // ISO
  /** Always positive; `kind` says which way the money went. */
  amount: number;
  kind: CapturedKind;
  account?: string;
  merchant?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The category used most recently for this merchant, or null so the user has to choose. */
export function suggestCategory(merchant: string | undefined, transactions: Transaction[]): CategoryId | null {
  if (!merchant?.trim()) return null;
  let latest: Transaction | null = null;
  for (const t of transactions) {
    if (t.category === "income" || !sameName(t.merchant, merchant)) continue;
    if (!latest || +new Date(t.date) > +new Date(latest.date)) latest = t;
  }
  return latest?.category ?? null;
}

/**
 * True when the same amount was already recorded or captured within a day: the user may have typed it by hand, or the
 * bank may have sent two alerts for one payment. The review list flags it instead of blocking anything.
 */
export function possibleDuplicate(
  item: CapturedItem,
  transactions: Transaction[],
  transfers: Transfer[],
  pending: CapturedItem[],
): boolean {
  const at = +new Date(item.receivedAt);
  const near = (iso: string) => Math.abs(+new Date(iso) - at) <= DAY_MS;
  return (
    transactions.some((t) => Math.abs(t.amount) === item.amount && near(t.date)) ||
    transfers.some((t) => t.amount === item.amount && near(t.date)) ||
    pending.some((p) => p.id !== item.id && p.amount === item.amount && near(p.receivedAt))
  );
}
