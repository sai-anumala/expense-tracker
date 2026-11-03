// Transfers between the user's own accounts (shared by client and server; pure, no DB imports).
// One Total Available Balance (Bank + UPI + Cash). A transfer is never income or spending. Transfers among
// Bank/UPI/Cash don't change the balance; paying the card bill (→ card) lowers it and a cash withdrawal from the
// card (card →) raises it (see lib/creditCard.ts transferCashEffect).

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

/** Taking cash out of the credit card (card → Bank/UPI/Cash) = cash withdrawal / advance. */
export const isCardAdvance = (t: Pick<Transfer, "from" | "to">) => t.from === "card" && t.to !== "card";

export const CARD_BILL_HINT =
  "Card bill payment: reduces your available balance and what you owe on the card. Not counted as spending — the purchases were already recorded.";

export const CARD_ADVANCE_HINT =
  "Cash withdrawal from your credit card: adds to your available balance and to what you owe on the card. Not counted as income.";

export const OWN_TRANSFER_HINT =
  "Moves money between your own accounts. Your available balance stays the same, and it's never income or spending.";

/** Explanation shown for a transfer route (form hint and details pop-up). */
export const transferHint = (t: Pick<Transfer, "from" | "to">) =>
  isCardBill(t) ? CARD_BILL_HINT : isCardAdvance(t) ? CARD_ADVANCE_HINT : OWN_TRANSFER_HINT;

/**
 * Defaults for a NEW transfer from query params (`/transfer?from=bank&to=card&amount=1234.5`, used by "Pay bill").
 * Unknown accounts fall back to Bank → Cash; equal from/to are ignored; amount must be > 0 (kept to 2 decimals).
 */
export function transferPrefill(get: (key: string) => string | null): { from: TransferAccount; to: TransferAccount; amount: string } {
  const f = get("from");
  const t = get("to");
  let from: TransferAccount = isTransferAccount(f) ? f : "bank";
  let to: TransferAccount = isTransferAccount(t) ? t : from === "cash" ? "bank" : "cash";
  if (from === to) [from, to] = ["bank", "cash"];
  const n = Number(get("amount"));
  const amount = Number.isFinite(n) && n > 0 ? (Math.round(n * 100) / 100).toFixed(2) : "";
  return { from, to, amount };
}

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
