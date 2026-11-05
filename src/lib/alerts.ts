// In-app reminders shown by the 🔔 bell and the Overview banner. Pure, client-safe; computed from loaded data.
// Rules: AGENTS.md §11 "Reminders". Nothing is persisted (no read/unread state).

import { categoryInfo, type Budget, type CustomCategory, type Settings, type Transaction } from "./data";
import type { Loan } from "./loans";
import type { Transfer } from "./transfers";
import { cardSummary } from "./creditCard";
import { loanStatus } from "./loans";
import { periodBounds, totalSpent, within } from "./insights";
import { money } from "./format";

export type AlertSeverity = "urgent" | "warning" | "info";
export type AlertIcon = "card" | "loan" | "budget" | "review";

export type Alert = {
  /** Stable id (same rule + record → same id), used as React key and for banner dismissal. */
  id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  href: string;
  icon: AlertIcon;
  /** Sort hint within a severity: the relevant date in ms (earlier = more pressing). */
  at: number;
};

/** Days before a card bill's due date when the reminder starts. */
export const CARD_DUE_SOON_DAYS = 5;
/** Card utilisation (due / limit) that triggers a warning. */
export const CARD_UTILIZATION_WARN = 0.8;
/** Days before a loan's next monthly payment when the reminder starts. */
export const LOAN_PAYMENT_SOON_DAYS = 3;
/** Share of a budget (monthly or category) spent that triggers a warning; ≥ 1 is urgent. */
export const BUDGET_WARN = 0.9;

const SEVERITY_RANK: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (from: Date, to: Date) => Math.round((+startOfDay(to) - +startOfDay(from)) / 86_400_000);
const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** "today" / "tomorrow" / "in N days" (N ≥ 2). */
function inDays(n: number) {
  if (n <= 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

/** "today" / "tomorrow" / "on 5 Nov". */
function onDay(d: Date, now: Date) {
  const n = daysBetween(now, d);
  return n <= 0 ? "today" : n === 1 ? "tomorrow" : `on ${shortDate(d)}`;
}

export type AlertInput = {
  transactions: Transaction[];
  transfers: Transfer[];
  loans: Loan[];
  budget: Budget;
  /** `card` / `cardDueAtAnchor` may be missing at runtime on older API responses; treated as "not set up". */
  settings: Pick<Settings, "balanceAsOf"> & Partial<Pick<Settings, "card" | "cardDueAtAnchor">>;
  /** Bank alerts from Gmail waiting for review. */
  pendingReview?: number;
  /** Names for budgets on the user's own categories. */
  customCategories?: CustomCategory[];
  now?: Date;
};

function reviewAlerts({ pendingReview, now }: Required<AlertInput>): Alert[] {
  if (pendingReview <= 0) return [];
  return [
    {
      id: "capture:pending",
      severity: "info",
      title: pendingReview === 1 ? "1 bank alert to review" : `${pendingReview} bank alerts to review`,
      body: "From Gmail. They don't count in your totals until you add them.",
      href: "/review",
      icon: "review",
      at: +now,
    },
  ];
}

function cardAlerts({ transactions, transfers, settings, now }: Required<AlertInput>): Alert[] {
  const card = settings.card;
  if (!card) return [];
  const s = cardSummary(transactions, transfers, card, settings, now);
  const out: Alert[] = [];
  if (s.billOutstanding > 0 && s.overdue) {
    out.push({
      id: "card:bill",
      severity: "urgent",
      title: `Card bill ${money(s.billOutstanding)} overdue`,
      body: `It was due on ${shortDate(s.dueDate)}. Pay it to avoid late fees and interest.`,
      href: "/card",
      icon: "card",
      at: +s.dueDate,
    });
  } else if (s.billOutstanding > 0 && s.daysToDue <= CARD_DUE_SOON_DAYS) {
    out.push({
      id: "card:bill",
      severity: "warning",
      title: `Card bill ${money(s.billOutstanding)} due ${inDays(s.daysToDue)}`,
      body: `Due on ${shortDate(s.dueDate)}. Record the payment as a transfer to your card.`,
      href: "/card",
      icon: "card",
      at: +s.dueDate,
    });
  }
  if (s.utilization !== null && s.utilization >= CARD_UTILIZATION_WARN && card.limit) {
    out.push({
      id: "card:utilization",
      severity: "warning",
      title: `Card usage ${Math.floor(s.utilization * 100)}% of limit`,
      body: `${money(s.due)} used of your ${money(card.limit)} limit.`,
      href: "/card",
      icon: "card",
      at: +s.nextStatement,
    });
  }
  return out;
}

function loanAlerts({ loans, now }: Required<AlertInput>): Alert[] {
  const out: Alert[] = [];
  for (const l of loans) {
    const st = loanStatus(l, now);
    if (st.settled) continue;
    const lent = l.direction === "lent";
    const href = `/loans/${l.id}`;
    if (st.overdue && l.dueDate) {
      out.push({
        id: `loan:${l.id}:overdue`,
        severity: "urgent",
        title: `Loan ${lent ? "to" : "from"} ${l.person} overdue`,
        body: `${money(st.outstanding)} ${lent ? "still to collect" : "still to pay"} · was due on ${shortDate(new Date(l.dueDate))}.`,
        href,
        icon: "loan",
        at: +new Date(l.dueDate),
      });
      continue; // the overdue alert already covers this loan
    }
    const next = st.nextPayment;
    if (next && l.monthlyPayment) {
      const days = daysBetween(now, next);
      if (days >= 0 && days <= LOAN_PAYMENT_SOON_DAYS) {
        const amount = Math.min(l.monthlyPayment, st.outstanding);
        out.push({
          id: `loan:${l.id}:next`,
          severity: "warning",
          title: lent
            ? `Collect ${money(amount)} from ${l.person} ${onDay(next, now)}`
            : `Pay ${money(amount)} to ${l.person} ${onDay(next, now)}`,
          body: `Monthly repayment · ${money(st.outstanding)} outstanding.`,
          href,
          icon: "loan",
          at: +next,
        });
      }
    }
  }
  return out;
}

function budgetAlert(id: string, name: string, spent: number, limit: number, monthEnd: Date): Alert | null {
  const used = spent / limit;
  if (used < BUDGET_WARN) return null;
  const over = Math.round((spent - limit) * 100) / 100;
  const body = `${money(spent)} of ${money(limit)} spent this month.`;
  if (used >= 1) {
    return {
      id,
      severity: "urgent",
      title: over > 0 ? `Over ${name} by ${money(over)}` : `${name[0].toUpperCase()}${name.slice(1)} fully used`,
      body,
      href: "/budgets",
      icon: "budget",
      at: +monthEnd,
    };
  }
  return {
    id,
    severity: "warning",
    title: `${name[0].toUpperCase()}${name.slice(1)} ${Math.floor(used * 100)}% used`,
    body,
    href: "/budgets",
    icon: "budget",
    at: +monthEnd,
  };
}

function budgetAlerts({ transactions, budget, now, customCategories }: Required<AlertInput>): Alert[] {
  const bounds = periodBounds("month", now);
  const month = within(transactions, bounds);
  const out: Alert[] = [];
  if (budget.monthlyLimit > 0) {
    const a = budgetAlert("budget:month", "monthly budget", totalSpent(month), budget.monthlyLimit, bounds[1]);
    if (a) out.push(a);
  }
  for (const c of budget.categories) {
    if (!(c.limit > 0)) continue;
    const spent = totalSpent(month.filter((t) => t.category === c.category));
    const a = budgetAlert(`budget:cat:${c.category}`, `${categoryInfo(c.category, customCategories).long} budget`, spent, c.limit, bounds[1]);
    if (a) out.push(a);
  }
  return out;
}

/** All current reminders, most important first: urgent → warning → info, then earliest date, then card → loans → budgets. */
export function buildAlerts(input: AlertInput): Alert[] {
  const full: Required<AlertInput> = {
    ...input,
    pendingReview: input.pendingReview ?? 0,
    now: input.now ?? new Date(),
    customCategories: input.customCategories ?? [],
  };
  const list = [...cardAlerts(full), ...loanAlerts(full), ...budgetAlerts(full), ...reviewAlerts(full)];
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => SEVERITY_RANK[x.a.severity] - SEVERITY_RANK[y.a.severity] || x.a.at - y.a.at || x.i - y.i)
    .map(({ a }) => a);
}

/** Alerts that count towards the bell badge (urgent + warning). */
export const isAttention = (a: Alert) => a.severity !== "info";
