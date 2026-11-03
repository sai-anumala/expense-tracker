// Transfers between the user's own accounts (shared by client and server; pure, no DB imports).
// Simple model: one Total Available Balance. A transfer only records that money moved; it never changes
// the balance and is never income or spending.

export const TRANSFER_ACCOUNTS = ["bank", "upi", "cash", "card"] as const;
export type TransferAccount = (typeof TRANSFER_ACCOUNTS)[number];

export const transferAccountLabels: Record<TransferAccount, string> = {
  bank: "Bank",
  upi: "UPI",
  cash: "Cash",
  card: "Credit Card",
};

export const isTransferAccount = (v: unknown): v is TransferAccount =>
  typeof v === "string" && (TRANSFER_ACCOUNTS as readonly string[]).includes(v);

export type Transfer = {
  id: string;
  from: TransferAccount;
  to: TransferAccount;
  /** Always positive. */
  amount: number;
  date: string; // ISO
  note?: string;
};

export type TransferInput = Omit<Transfer, "id">;

/** "Bank → Cash" */
export const transferRoute = (t: Pick<Transfer, "from" | "to">) =>
  `${transferAccountLabels[t.from]} → ${transferAccountLabels[t.to]}`;

/** Paying the credit card from another account = card bill payment (purchases were already recorded as expenses). */
export const isCardBill = (t: Pick<Transfer, "from" | "to">) => t.to === "card" && t.from !== "card";

export const CARD_BILL_HINT =
  "Card bill payment. Not counted as spending, because the purchases were already recorded as expenses.";

export type FeedItem<T> = { kind: "transaction"; item: T; date: string } | { kind: "transfer"; item: Transfer; date: string };

/**
 * Merge transactions and transfers into one feed, newest first. Ties keep transactions before transfers
 * and otherwise preserve input order (stable sort). Invalid dates sort last.
 */
export function mergeFeed<T extends { date: string }>(transactions: T[], transfers: Transfer[]): FeedItem<T>[] {
  const time = (iso: string) => {
    const n = new Date(iso).getTime();
    return Number.isNaN(n) ? -Infinity : n;
  };
  const items: FeedItem<T>[] = [
    ...transactions.map((t) => ({ kind: "transaction" as const, item: t, date: t.date })),
    ...transfers.map((t) => ({ kind: "transfer" as const, item: t, date: t.date })),
  ];
  return items.sort((a, b) => time(b.date) - time(a.date));
}

/** Transfers dated within [start, end): count and total moved. */
export function transferTotals(list: Transfer[], [start, end]: [Date, Date]) {
  let count = 0;
  let amount = 0;
  for (const t of list) {
    const d = new Date(t.date).getTime();
    if (d >= start.getTime() && d < end.getTime()) {
      count += 1;
      amount += t.amount;
    }
  }
  return { count, amount: Math.round(amount * 100) / 100 };
}
