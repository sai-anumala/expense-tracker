"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Leaf,
  PieChart,
  Clock,
  CirclePlus,
  Banknote,
  ChartSpline,
  ChevronRight,
  Lightbulb,
  ReceiptText,
  X,
} from "lucide-react";
import { AppHeader, MonthPill, ProgressBar } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { useAppData } from "@/lib/store";
import { categories, type Transaction } from "@/lib/data";
import { categoryInsight, net, periodBounds, totalIncome, totalSpent, within } from "@/lib/insights";
import { dayBucket, daysLeftInMonth, plural, money, monthLabel } from "@/lib/format";

const quickActions = [
  { label: "Add Expense", icon: CirclePlus, href: "/add", accent: true },
  { label: "Add Income", icon: Banknote, href: "/add?kind=income" },
  { label: "Budgets", icon: PieChart, href: "/budgets" },
  { label: "Analytics", icon: ChartSpline, href: "/analytics" },
];

export default function Dashboard() {
  const { transactions, budget } = useAppData();
  const [tipOpen, setTipOpen] = useState(true);

  const thisMonth = within(transactions, periodBounds("month"));
  const lastMonth = within(transactions, periodBounds("month", new Date(), 1));
  const limit = budget.monthlyLimit;

  // Triad row (this month): Income, Spent, and To Spend = monthly budget − spent (0 when no budget is set).
  const income = totalIncome(thisMonth);
  const spent = totalSpent(thisMonth);
  const toSpend = limit - spent;

  // Total Available Balance = Income − Spent + To Spend (the three tiles added up, as displayed).
  const totalOf = (inc: number, sp: number) => inc - sp + (limit > 0 ? limit - sp : 0);
  const balance = totalOf(income, spent);
  // "+x% this mo" badge: change vs the same total for last month (with the current budget).
  const lastTotal = totalOf(totalIncome(lastMonth), totalSpent(lastMonth));
  const growth = lastMonth.length > 0 && lastTotal > 0 ? ((balance - lastTotal) / lastTotal) * 100 : null;
  const used = limit > 0 ? spent / limit : 0;
  const daysLeft = daysLeftInMonth();
  const [whole, cents] = money(balance).split(".");
  const insight = categoryInsight(transactions);

  const groups = new Map<string, Transaction[]>();
  for (const t of transactions.slice(0, 8)) {
    const k = dayBucket(t.date);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <>
      <AppHeader subtitle="Overview" />
      <TabPage>
        <div className="flex items-center justify-between">
          <MonthPill label={monthLabel()} />
          {limit > 0 && (
            <span
              className={`label-caps flex items-center gap-1.5 rounded-full px-3 py-2 ${
                used < 0.85 ? "bg-primary-fixed/50 text-primary" : "bg-tertiary-fixed text-tertiary"
              }`}
            >
              <Leaf className="size-4" aria-hidden />{" "}
              {used < 0.85 ? "On track" : used <= 1 ? "Watch spend" : "Over budget"}
            </span>
          )}
        </div>

        {/* Balance (Stitch: "Hero Total Balance Card") */}
        <section className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          {/* ambient glow */}
          <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-primary-fixed/20 blur-xl" />

          <div className="relative z-10 flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs font-medium text-on-surface-variant">
                Total Available Balance
              </span>
              {growth !== null && Math.abs(growth) >= 0.05 && (
                <span
                  className={`label-caps inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 normal-case ${
                    growth >= 0 ? "text-primary" : "text-secondary"
                  }`}
                >
                  {growth >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                  {growth >= 0 ? "+" : "-"}
                  {Math.abs(growth).toFixed(1)}% this mo
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1" title="Income − Spent + To Spend">
              <span
                className={`text-[36px] leading-[44px] font-bold tracking-[-0.03em] ${
                  balance < 0 ? "text-secondary" : "text-on-surface"
                }`}
              >
                {balance < 0 && "-"}
                {whole}
                <span className="font-medium text-on-surface-variant">.{cents}</span>
              </span>
            </div>

            {/* Triad metrics: this month */}
            <div className="grid grid-cols-3 gap-1 pt-1">
              <Metric icon={ArrowDown} label="Income" value={`+${money(income)}`} tone="primary" />
              <Metric icon={ArrowUp} label="Spent" value={`-${money(spent)}`} tone="secondary" />
              <Metric
                icon={PiggyBank}
                label="To Spend"
                value={limit > 0 ? `${toSpend < 0 ? "-" : ""}${money(toSpend)}` : "—"}
                tone={toSpend < 0 ? "secondary" : "neutral"}
                title={
                  limit > 0
                    ? `${money(limit)} monthly budget − ${money(spent)} spent this month`
                    : "Set a monthly budget to see what's safe to spend"
                }
              />
            </div>
          </div>
        </section>

        {/* Monthly budget */}
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-lg font-semibold">
              <span className="grid size-10 place-items-center rounded-lg bg-surface-container">
                <PieChart className="size-5 text-primary" aria-hidden />
              </span>
              Monthly Budget
            </h2>
            {limit > 0 && (
              <span className="rounded-full bg-primary-fixed/50 px-3 py-1 font-mono text-sm font-semibold text-primary">
                {Math.round(used * 100)}% used
              </span>
            )}
          </div>
          {limit > 0 ? (
            <>
              <ProgressBar value={used} tone={used < 0.9 ? "primary" : "tertiary"} />
              <div className="mt-3 flex justify-between font-mono text-sm text-on-surface-variant">
                <span>{money(spent)} spent</span>
                <span>{money(limit)} cap</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <Clock className="size-4 text-tertiary" aria-hidden /> Daily safe pace:
                  <b className="font-mono text-on-surface">{money(Math.max(0, toSpend) / daysLeft)}/day</b>
                </span>
                <span className="font-mono text-on-surface-variant">{plural(daysLeft, "day")} left</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-on-surface-variant">No monthly budget set yet.</p>
              <Link href="/budgets" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary">
                Set budget
              </Link>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="label-caps mb-3 px-1 text-on-surface-variant">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(({ label, icon: Icon, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="card flex flex-col items-center gap-2 px-1 py-4 text-center text-sm transition hover:-translate-y-0.5"
              >
                <span
                  className={`grid size-12 place-items-center rounded-full ${
                    accent ? "bg-primary-fixed/50 text-primary" : "bg-surface-container-high"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* Recent transactions */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[22px] font-semibold tracking-tight">Recent Transactions</h2>
            {transactions.length > 0 && (
              <Link href="/accounts" className="flex items-center text-sm font-medium text-primary">
                View All <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {transactions.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No transactions yet"
              body="Add your first expense or income and it will show up here."
              action={
                <Link href="/add" className="rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
                  Add transaction
                </Link>
              }
            />
          ) : (
            [...groups].map(([day, list]) => {
              const dayNet = net(list);
              return (
                <div key={day} className="mt-4">
                  <div className="label-caps mb-2 flex justify-between px-1 text-on-surface-variant">
                    <span>{day}</span>
                    <span className={`font-mono normal-case ${dayNet > 0 ? "text-primary" : ""}`}>
                      {dayNet < 0 ? "-" : "+"}
                      {money(dayNet)}
                      {dayNet > 0 && " net"}
                    </span>
                  </div>
                  <ul className="card divide-y divide-surface-container px-5">
                    {list.map((t) => (
                      <TransactionRow key={t.id} t={t} />
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>

        {tipOpen && insight && (
          <aside className="flex items-center gap-4 rounded-xl bg-surface-container-low p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-fixed/60 text-primary">
              <Lightbulb className="size-5" aria-hidden />
            </span>
            <p className="flex-1 text-sm">
              You&apos;re spending{" "}
              <span className={`font-medium ${insight.pct < 0 ? "text-primary" : "text-secondary"}`}>
                {Math.abs(Math.round(insight.pct))}% {insight.pct < 0 ? "less" : "more"}
              </span>{" "}
              on {categories[insight.category].long.toLowerCase()} than last month.
            </p>
            <button aria-label="Dismiss tip" onClick={() => setTipOpen(false)} className="p-1">
              <X className="size-5" />
            </button>
          </aside>
        )}
      </TabPage>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  title,
}: {
  icon: typeof ArrowDown;
  label: string;
  value: string;
  tone: "primary" | "secondary" | "neutral";
  title?: string;
}) {
  const color = { primary: "text-primary", secondary: "text-secondary", neutral: "text-on-surface" }[tone];
  return (
    <div title={title} className="flex flex-col justify-between rounded-lg bg-surface-container-low p-2.5">
      <div className={`flex items-center gap-1 ${tone === "neutral" ? "text-on-surface-variant" : color}`}>
        <Icon className="size-3.5" aria-hidden />
        <span className="text-[11px] font-medium text-on-surface-variant">{label}</span>
      </div>
      <span className={`truncate pt-1 font-mono text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}
