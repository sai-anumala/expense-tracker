// Credit card model (single card) + the cash events behind Total Available Balance. Pure, client-safe.
//
// A credit card is money you OWE, not money you have:
//   • Available balance = Bank + UPI + Cash. Card purchases do NOT reduce it (they increase "card due").
//   • Card purchases still count as spending in the month you buy (budgets/analytics use transactions as-is).
//   • Paying the card bill (transfer Bank/UPI/Cash → Card) DOES reduce the available balance and the card due,
//     and is never spending. A cash withdrawal from the card (transfer Card → X) adds cash and adds card due.
//   • Transfers between Bank/UPI/Cash stay neutral.
// See AGENTS.md §11 "Credit card".

import type { Settings, Transaction } from "./data";
import type { Loan } from "./loans";
import { loanCashEvents } from "./loans";
import type { Transfer } from "./transfers";

/** Transaction payment-method label that means "paid with the credit card". */
export const CARD_ACCOUNT = "Credit Card";

export const isCardTransaction = (t: Pick<Transaction, "account">) => t.account === CARD_ACCOUNT;

export type CardSettings = {
  /** Day of month the statement is generated (bill closes at the end of this day), 1–28. */
  statementDay: number;
  /** Day of month the bill must be paid, 1–28 (in the month after the statement if ≤ statementDay). */
  dueDay: number;
  /** Optional credit limit (> 0). */
  limit?: number;
};

type CashEvent = { amount: number; date: string };

/**
 * Signed cash movements that make up Total Available Balance (+ in, − out), under the card model:
 * non-card transactions as-is, card transactions excluded, transfers to the card = −amount (bill paid),
 * transfers from the card = +amount (cash withdrawal), other transfers neutral, loans via loanCashEvents.
 * Feed this to `anchoredBalance` (which keeps only events dated ≥ balanceAsOf).
 */
export function availableCashEvents(
  transactions: Transaction[],
  transfers: Transfer[],
  loans: Loan[],
): (CashEvent & { kind: "transaction" | "transfer" | "loan" })[] {
  const out: (CashEvent & { kind: "transaction" | "transfer" | "loan" })[] = [];
  for (const t of transactions) if (!isCardTransaction(t)) out.push({ amount: t.amount, date: t.date, kind: "transaction" });
  for (const tr of transfers) {
    const amount = transferCashEffect(tr);
    if (amount !== 0) out.push({ amount, date: tr.date, kind: "transfer" });
  }
  for (const e of loanCashEvents(loans)) out.push({ ...e, kind: "loan" });
  return out;
}

/**
 * Signed effect of one transfer on Total Available Balance: bill payment (X → card) −amount,
 * cash withdrawal (card → X) +amount, anything else 0.
 */
export function transferCashEffect(t: Pick<Transfer, "from" | "to" | "amount">): number {
  if (t.to === "card" && t.from !== "card") return -t.amount;
  if (t.from === "card" && t.to !== "card") return t.amount;
  return 0;
}

/** Cash that leaves the available balance for an expense of `amount` (> 0): 0 when paid with the credit card. */
export const expenseCashOutflow = (amount: number, account: string | undefined) =>
  account === CARD_ACCOUNT ? 0 : amount;

/**
 * What is owed on the card right now (no statement setup needed): `cardDueAtAnchor` at `balanceAsOf`
 * plus card events dated ≥ the anchor (all events from 0 without an anchor). Negative = card credit.
 */
export function currentCardDue(
  transactions: Transaction[],
  transfers: Transfer[],
  settings: Pick<Settings, "balanceAsOf"> & { cardDueAtAnchor?: number | null },
): number {
  const anchor = settings.balanceAsOf ? new Date(settings.balanceAsOf) : null;
  const start = anchor ? (settings.cardDueAtAnchor ?? 0) : 0;
  const sum = cardDueEvents(transactions, transfers)
    .filter((e) => !anchor || new Date(e.date) >= anchor)
    .reduce((s, e) => s + e.amount, 0);
  return round(start + sum);
}

/**
 * One-time Overview prompt after the card model shipped: the balance was entered before the unpaid card amount
 * existed (`cardDueAtAnchor` null) and card activity since then now changes the numbers. True when a balance is set,
 * `cardDueAtAnchor` is null, and a card transaction or a transfer to/from the card is dated ≥ `balanceAsOf`.
 */
export function needsCardDuePrompt(
  transactions: Transaction[],
  transfers: Transfer[],
  settings: Pick<Settings, "openingBalance" | "balanceAsOf" | "cardDueAtAnchor">,
): boolean {
  if (settings.openingBalance === null || !settings.balanceAsOf || settings.cardDueAtAnchor !== null) return false;
  const anchor = new Date(settings.balanceAsOf);
  return cardDueEvents(transactions, transfers).some((e) => new Date(e.date) >= anchor);
}

/**
 * Card-due movements (+ you owe more, − you owe less): card purchase +|amount|, refund/credit on the card −amount,
 * bill payment (transfer → card) −amount, cash withdrawal (transfer card →) +amount.
 */
export function cardDueEvents(transactions: Transaction[], transfers: Transfer[]): (CashEvent & { kind: "purchase" | "refund" | "payment" | "advance"; id: string })[] {
  const out: (CashEvent & { kind: "purchase" | "refund" | "payment" | "advance"; id: string })[] = [];
  for (const t of transactions) {
    if (!isCardTransaction(t)) continue;
    out.push(
      t.amount < 0
        ? { amount: -t.amount, date: t.date, kind: "purchase", id: t.id }
        : { amount: -t.amount, date: t.date, kind: "refund", id: t.id },
    );
  }
  for (const tr of transfers) {
    if (tr.to === "card" && tr.from !== "card") out.push({ amount: -tr.amount, date: tr.date, kind: "payment", id: tr.id });
    else if (tr.from === "card" && tr.to !== "card") out.push({ amount: tr.amount, date: tr.date, kind: "advance", id: tr.id });
  }
  return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

const round = (n: number) => Math.round(n * 100) / 100;
const endOfDay = (y: number, m: number, d: number) => new Date(y, m, d, 23, 59, 59, 999);

/** End of the most recent statement day on/before `now` (statement closes at 23:59:59.999 local). */
export function lastStatementEnd(statementDay: number, now: Date): Date {
  const thisMonth = endOfDay(now.getFullYear(), now.getMonth(), statementDay);
  return thisMonth <= now ? thisMonth : endOfDay(now.getFullYear(), now.getMonth() - 1, statementDay);
}

/** Payment due date (end of day) for a statement that closed on `statementEnd`. */
export function dueDateFor(statementEnd: Date, s: Pick<CardSettings, "statementDay" | "dueDay">): Date {
  const monthOffset = s.dueDay > s.statementDay ? 0 : 1;
  return endOfDay(statementEnd.getFullYear(), statementEnd.getMonth() + monthOffset, s.dueDay);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type CardSummary = {
  /** Total owed right now (billed + unbilled). Negative = card credit (overpaid). */
  due: number;
  /** Amount of the last statement still unpaid (≥ 0). */
  billOutstanding: number;
  /** What the last statement asked for (≥ 0). */
  billed: number;
  /** Spent since the last statement, net of refunds/extra payments (≥ 0); goes on the next bill. */
  unbilled: number;
  /** Overpaid amount when due < 0, else 0. */
  credit: number;
  lastStatement: Date;
  nextStatement: Date;
  dueDate: Date;
  /** Whole days from today to dueDate (negative = overdue). */
  daysToDue: number;
  overdue: boolean;
  /** due / limit (0–1+), or null without a limit. */
  utilization: number | null;
  /** Card events since the last statement (newest first) and in the billed cycle (newest first). */
  unbilledEvents: ReturnType<typeof cardDueEvents>;
  billedEvents: ReturnType<typeof cardDueEvents>;
};

/**
 * Card position at `now`. Card due starts from `settings.cardDueAtAnchor` (unpaid card amount the user entered
 * with their balance) at `settings.balanceAsOf`, plus card events dated ≥ that anchor. Without an anchor, all events
 * count from 0. Events before the anchor are ignored (already reflected in the entered amount).
 * If the anchor is after the last statement, the entered unpaid amount is treated as the current bill (approximation
 * until the next statement, after which numbers are exact).
 */
export function cardSummary(
  transactions: Transaction[],
  transfers: Transfer[],
  card: CardSettings,
  settings: Pick<Settings, "balanceAsOf"> & { cardDueAtAnchor?: number | null },
  now = new Date(),
): CardSummary {
  const anchor = settings.balanceAsOf ? new Date(settings.balanceAsOf) : null;
  const startDue = anchor ? (settings.cardDueAtAnchor ?? 0) : 0;
  const events = cardDueEvents(transactions, transfers).filter((e) => !anchor || new Date(e.date) >= anchor);
  const dueAt = (t: Date) => round(startDue + events.filter((e) => new Date(e.date) <= t).reduce((s, e) => s + e.amount, 0));

  const lastStatement = lastStatementEnd(card.statementDay, now);
  const prevStatement = lastStatementEnd(card.statementDay, new Date(lastStatement.getTime() - 1000));
  const nextStatement = endOfDay(lastStatement.getFullYear(), lastStatement.getMonth() + 1, card.statementDay);

  const due = dueAt(now);
  const anchorAfterStatement = anchor !== null && anchor > lastStatement;
  const billed = Math.max(0, anchorAfterStatement ? startDue : dueAt(lastStatement));
  const paidSince = events
    .filter((e) => e.kind === "payment" && new Date(e.date) > (anchorAfterStatement ? anchor! : lastStatement))
    .reduce((s, e) => s - e.amount, 0);
  const billOutstanding = round(Math.max(0, billed - paidSince));
  const unbilled = round(Math.max(0, due - billOutstanding));
  const credit = due < 0 ? round(-due) : 0;

  const dueDate = dueDateFor(lastStatement, card);
  const daysToDue = Math.round((+startOfDay(dueDate) - +startOfDay(now)) / 86_400_000);
  const overdue = billOutstanding > 0 && now > dueDate;

  const newestFirst = (a: { date: string }, b: { date: string }) => +new Date(b.date) - +new Date(a.date);
  const unbilledEvents = events.filter((e) => new Date(e.date) > lastStatement).sort(newestFirst);
  const billedEvents = events
    .filter((e) => new Date(e.date) > prevStatement && new Date(e.date) <= lastStatement)
    .sort(newestFirst);

  return {
    due,
    billOutstanding,
    billed: round(billed),
    unbilled,
    credit,
    lastStatement,
    nextStatement,
    dueDate,
    daysToDue,
    overdue,
    utilization: card.limit ? Math.max(0, due) / card.limit : null,
    unbilledEvents,
    billedEvents,
  };
}
