import type { Budget, BudgetEntry, Transaction } from "./data";

/** Most months of budget history kept per user. The oldest are dropped. */
export const HISTORY_CAP = 36;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && MONTH_RE.test(v);

/** "2026-11" for a local date. */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Months since year 0, so two keys can be compared or subtracted. */
export const monthIndex = (key: string) => {
  const m = MONTH_RE.exec(key);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN;
};

/** Local [start, end) of a month key. */
export function monthBounds(key: string): [Date, Date] {
  const m = MONTH_RE.exec(key);
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const mo = m ? Number(m[2]) - 1 : new Date().getMonth();
  return [new Date(y, mo, 1), new Date(y, mo + 1, 1)];
}

/** "October 2026" for a month key. */
export const monthKeyLabel = (key: string) =>
  monthBounds(key)[0].toLocaleDateString("en-US", { month: "long", year: "numeric" });

export type MonthBudget = {
  monthlyLimit: number;
  categories: BudgetEntry["categories"];
  /** False when no saved limit covers this month, so the figures use the earliest limit we have. */
  recorded: boolean;
};

/**
 * The limits a month is measured against.
 * - Current month: the live budget.
 * - Past month: the last save made in that month or, if none, the latest save before it (a limit stays
 *   in force until it is changed). Before the first saved limit there is nothing to go on, so the
 *   earliest saved one (or the live budget when there is no history) is used and `recorded` is false.
 * `keep` drops categories that no longer exist (a deleted custom category).
 */
export function budgetForMonth(
  budget: Budget,
  month: string,
  current: string,
  keep: (category: string) => boolean = () => true,
): MonthBudget {
  const pick = (e: { monthlyLimit: number; categories: BudgetEntry["categories"] }, recorded: boolean): MonthBudget => ({
    monthlyLimit: e.monthlyLimit,
    categories: e.categories.filter((c) => keep(c.category)),
    recorded,
  });
  if (month === current) return pick(budget, true);
  const history = [...(budget.history ?? [])].sort((a, b) => monthIndex(a.month) - monthIndex(b.month));
  const covering = history.filter((e) => monthIndex(e.month) <= monthIndex(month)).pop();
  if (covering) return pick(covering, true);
  return pick(history[0] ?? budget, false);
}

/**
 * History after saving `entry`: one entry per month (the last save in a month wins), oldest first,
 * at most `cap` entries.
 */
export function upsertHistory(history: BudgetEntry[], entry: BudgetEntry, cap = HISTORY_CAP): BudgetEntry[] {
  return [...history.filter((h) => h.month !== entry.month), entry]
    .sort((a, b) => monthIndex(a.month) - monthIndex(b.month))
    .slice(-cap);
}

export type MonthSummary = { month: string; spent: number };

/**
 * The months worth listing in the picker, newest first: the current month, and every earlier month with
 * a transaction or a saved budget. Future months never appear. `spent` = expenses that month.
 */
export function monthSummaries(transactions: Transaction[], budget: Budget, current: string): MonthSummary[] {
  const spent = new Map<string, number>([[current, 0]]);
  const now = monthIndex(current);
  const add = (key: string, amount = 0) => {
    const i = monthIndex(key);
    if (Number.isNaN(i) || i > now) return;
    spent.set(key, (spent.get(key) ?? 0) + amount);
  };
  for (const t of transactions) {
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) continue;
    add(monthKey(d), t.amount < 0 ? -t.amount : 0);
  }
  for (const h of budget.history ?? []) add(h.month);
  return [...spent]
    .map(([month, total]) => ({ month, spent: total }))
    .sort((a, b) => monthIndex(b.month) - monthIndex(a.month));
}
