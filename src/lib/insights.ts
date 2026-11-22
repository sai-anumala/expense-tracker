import type { CategoryId, Transaction } from "./data";

export type Range = "week" | "month" | "year";

/** [start, end) of the period containing `d`, shifted back `back` periods. */
export function periodBounds(range: Range, d = new Date(), back = 0): [Date, Date] {
  if (range === "year") {
    const y = d.getFullYear() - back;
    return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  }
  if (range === "month") {
    const m = d.getMonth() - back;
    return [new Date(d.getFullYear(), m, 1), new Date(d.getFullYear(), m + 1, 1)];
  }
  // Week starts Monday.
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * back);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return [start, end];
}

export function within(list: Transaction[], [start, end]: [Date, Date]) {
  return list.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d < end;
  });
}

export const expenses = (list: Transaction[]) => list.filter((t) => t.amount < 0);
export const totalSpent = (list: Transaction[]) => expenses(list).reduce((s, t) => s - t.amount, 0);
export const totalIncome = (list: Transaction[]) =>
  list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
/** Sum of signed amounts (works for transactions and loan cash events). */
export const net = (list: { amount: number }[]) => list.reduce((s, t) => s + t.amount, 0);

/** Share of the budget used: up to this is green ("healthy"). */
export const BUDGET_CAUTION = 0.6;
/** Up to this is yellow ("spending caution"); above it is orange until the limit, then red. */
export const BUDGET_HIGH = 0.8;

export type BudgetLevel = "ok" | "caution" | "high" | "over";

/** One colour scale for every budget figure (Overview and Budgets): green, yellow, orange, red (over the limit). */
export function budgetLevel(used: number): BudgetLevel {
  if (used > 1) return "over";
  if (used > BUDGET_HIGH) return "high";
  if (used > BUDGET_CAUTION) return "caution";
  return "ok";
}

const STATUS_TEXT: Record<BudgetLevel, string> = {
  ok: "On track",
  caution: "Spending caution",
  high: "Almost exhausted",
  over: "Over budget",
};

/** How the monthly budget is going, from the share used. Wording for `budgetLevel`. */
export const budgetStatus = (used: number) => STATUS_TEXT[budgetLevel(used)];

export function spentByCategory(list: Transaction[]) {
  const map = new Map<CategoryId, number>();
  for (const t of expenses(list)) map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
  return [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function topMerchants(list: Transaction[], n = 3) {
  const map = new Map<string, { name: string; amount: number; count: number; category: CategoryId }>();
  for (const t of expenses(list)) {
    const key = t.merchant.trim().toLowerCase();
    const cur = map.get(key) ?? { name: t.merchant, amount: 0, count: 0, category: t.category };
    cur.amount += -t.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, n);
}

/** Spending for the `n` weeks up to the week containing `ref` (oldest first, that week last). */
export function weeklySpend(list: Transaction[], n = 4, ref = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const back = n - 1 - i;
    const bounds = periodBounds("week", ref, back);
    return { start: bounds[0], amount: totalSpent(within(list, bounds)), current: back === 0 };
  });
}

/** A real comparison of the month containing `ref` (default: this month) with the month before, for the biggest-moving category, if any. */
export function categoryInsight(list: Transaction[], ref = new Date()) {
  const now = spentByCategory(within(list, periodBounds("month", ref)));
  const prev = new Map(spentByCategory(within(list, periodBounds("month", ref, 1))).map((c) => [c.category, c.amount]));
  let best: { category: CategoryId; pct: number } | null = null;
  for (const c of now) {
    const p = prev.get(c.category);
    if (!p) continue;
    const pct = ((c.amount - p) / p) * 100;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { category: c.category, pct };
  }
  return best && Math.round(best.pct) !== 0 ? best : null;
}

/**
 * Total Available Balance anchored to when the user entered it. `list` = transactions plus loan cash
 * events (lib/loans.ts loanCashEvents), so lending/borrowing/repayments move the balance too.
 * - balance = entered amount + net of transactions dated AT OR AFTER `asOf` (earlier ones are ignored)
 * - base (for the "±x% this mo" badge) = balance on `monthStart`, or the entered amount if it was
 *   entered this month. Never uses transactions dated before `asOf`.
 */
export function anchoredBalance<T extends { amount: number; date: string }>(
  list: T[],
  entered: number | null,
  asOfIso: string | null,
  monthStart: Date,
): { balance: number; base: number | null; counted: T[] } {
  if (entered === null || !asOfIso) return { balance: entered ?? 0, base: null, counted: [] };
  const asOf = new Date(asOfIso);
  const counted = list.filter((t) => new Date(t.date) >= asOf);
  const balance = entered + net(counted);
  const base = asOf >= monthStart ? entered : entered + net(counted.filter((t) => new Date(t.date) < monthStart));
  return { balance, base, counted };
}
