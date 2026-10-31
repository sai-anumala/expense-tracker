"use client";

import { useState } from "react";
import { CalendarDays, TrendingDown, TrendingUp, Lightbulb, Download, ChartSpline } from "lucide-react";
import { AppHeader, IconTile } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState } from "@/components/TransactionRow";
import { categories, categoryName, type Transaction } from "@/lib/data";
import { useAppData } from "@/lib/store";
import {
  categoryInsight,
  periodBounds,
  spentByCategory,
  topMerchants,
  totalSpent,
  weeklySpend,
  within,
  type Range,
} from "@/lib/insights";
import { CURRENCY_SYMBOL, money, moneyWhole } from "@/lib/format";

export default function Analytics() {
  const { transactions, budget } = useAppData();
  const [range, setRange] = useState<Range>("month");

  const current = within(transactions, periodBounds(range));
  const previous = within(transactions, periodBounds(range, new Date(), 1));
  const total = totalSpent(current);
  const prevTotal = totalSpent(previous);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const [whole, cents] = money(total).replace(CURRENCY_SYMBOL, "").split(".");
  const breakdown = spentByCategory(current);
  const merchants = topMerchants(current);
  const weeks = weeklySpend(transactions);
  const weekTarget = budget.monthlyLimit > 0 ? (budget.monthlyLimit * 12) / 52 : 0;
  const insight = categoryInsight(transactions);
  const monthBudgetDelta = range === "month" && budget.monthlyLimit > 0 ? budget.monthlyLimit - total : null;

  return (
    <>
      <AppHeader subtitle="Analytics" />
      <TabPage>
        <div role="tablist" className="grid grid-cols-3 rounded-full bg-surface-container-high p-1.5">
          {(["week", "month", "year"] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={`rounded-full py-2 capitalize transition ${
                range === r ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Total */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <p className="label-caps text-on-surface-variant">Total spent this {range}</p>
            <CalendarDays className="size-5 text-on-surface-variant" aria-hidden />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-5xl font-bold tracking-tight">
              <span className="mr-1 align-middle text-2xl font-normal text-on-surface-variant">{CURRENCY_SYMBOL}</span>
              {whole}.{cents}
            </p>
            {change !== null && (
              <span
                className={`flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 font-mono text-sm font-semibold ${
                  change <= 0 ? "text-primary" : "text-secondary"
                }`}
              >
                {change <= 0 ? <TrendingDown className="size-4" aria-hidden /> : <TrendingUp className="size-4" aria-hidden />}
                {Math.abs(Math.round(change))}%
              </span>
            )}
          </div>
          <div className="mt-3 flex justify-between gap-3 text-sm">
            <span className="text-on-surface-variant">
              Previous {range}: <b className="font-mono text-on-surface">{money(prevTotal)}</b>
            </span>
            {monthBudgetDelta !== null && (
              <span className={monthBudgetDelta >= 0 ? "text-primary" : "text-secondary"}>
                {monthBudgetDelta >= 0 ? "Under" : "Over"} budget by {money(monthBudgetDelta)}
              </span>
            )}
          </div>
        </section>

        {insight && (
          <section className="flex gap-4 rounded-xl bg-surface-container-low p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-container-high text-primary">
              <Lightbulb className="size-5" aria-hidden />
            </span>
            <div>
              <p className="label-caps text-primary">Spending Insight</p>
              <p className="mt-1">
                You spent{" "}
                <span className={`font-medium ${insight.pct < 0 ? "text-primary" : "text-secondary"}`}>
                  {Math.abs(Math.round(insight.pct))}% {insight.pct < 0 ? "less" : "more"}
                </span>{" "}
                on {categories[insight.category].long.toLowerCase()} this month than last month.
              </p>
            </div>
          </section>
        )}

        {current.length === 0 ? (
          <EmptyState
            icon={ChartSpline}
            title={`No spending this ${range}`}
            body="Once you add expenses, your category breakdown and top merchants will appear here."
          />
        ) : (
          <>
            {/* Donut */}
            <section className="card p-5">
              <h2 className="text-[22px] font-semibold tracking-tight">Category Breakdown</h2>
              <p className="text-sm text-on-surface-variant">Where your money went this {range}</p>
              <div className="relative mx-auto my-6 size-56">
                <Donut data={breakdown.map((b) => ({ ...b, color: categories[b.category].color }))} total={total} />
                <div className="absolute inset-0 grid place-content-center px-8 text-center">
                  <p className="label-caps text-on-surface-variant">Top Category</p>
                  <p className="text-xl font-semibold">{categories[breakdown[0].category].long}</p>
                  <p className="font-mono text-primary">
                    {Math.round((breakdown[0].amount / total) * 100)}% ({money(breakdown[0].amount)})
                  </p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {breakdown.map((c) => (
                  <li key={c.category} className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: categories[c.category].color }} />
                    <span className="min-w-0 flex-1 truncate">{categories[c.category].long}</span>
                    <span className="font-mono font-medium">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Merchants */}
            <section className="card p-5">
              <h2 className="text-[22px] font-semibold tracking-tight">Top Merchants</h2>
              <p className="mb-4 text-sm text-on-surface-variant">Highest spending this {range}</p>
              <ul className="space-y-2">
                {merchants.map((m) => (
                  <li key={m.name} className="flex items-center gap-4 rounded-lg bg-surface-container-low p-4">
                    <IconTile icon={categories[m.category].icon} tone={categories[m.category].tone} round size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.name}</p>
                      <p className="text-sm text-on-surface-variant">
                        {m.count} {m.count === 1 ? "transaction" : "transactions"} • {categories[m.category].long}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">-{money(m.amount)}</p>
                      <p className="text-xs text-on-surface-variant">{Math.round((m.amount / total) * 100)}% of total</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Weekly trend (always last 4 weeks) */}
        <section className="card p-5">
          <h2 className="text-[22px] font-semibold tracking-tight">Weekly Spending Trend</h2>
          <p className="text-sm text-on-surface-variant">
            Last 4 weeks{weekTarget > 0 && `, paced against ${money(weekTarget)}/wk from your budget`}
          </p>
          <WeeklyBars weeks={weeks} target={weekTarget} />
        </section>

        <button
          onClick={() => downloadCsv(transactions)}
          disabled={transactions.length === 0}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-surface-container-low py-4 disabled:opacity-50"
        >
          <Download className="size-5" aria-hidden /> Download Transactions (CSV)
        </button>
      </TabPage>
    </>
  );
}

function downloadCsv(list: Transaction[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Date", "Merchant", "Category", "Account", "Amount (INR)"],
    ...list.map((t) => [t.date, t.merchant, categoryName(t), t.account ?? "", t.amount.toFixed(2)]),
  ];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ledgerly-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Donut({ data, total }: { data: { category: string; amount: number; color: string }[]; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Spending by category">
      {data.map((d) => {
        const len = (d.amount / total) * c;
        const el = (
          <circle
            key={d.category}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="10"
            strokeLinecap={data.length > 1 ? "round" : "butt"}
            strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
            strokeDashoffset={-offset}
          >
            <title>{`${categories[d.category as keyof typeof categories]?.long}: ${money(d.amount)}`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function WeeklyBars({ weeks, target }: { weeks: { start: Date; amount: number; current: boolean }[]; target: number }) {
  const max = Math.max(...weeks.map((w) => w.amount), target, 1) * 1.15;
  const h = 150;
  const label = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="relative my-6" style={{ height: h + 28 }}>
      {target > 0 && (
        <div
          className="absolute inset-x-0 border-t border-dashed border-outline-variant"
          style={{ bottom: 28 + (target / max) * h }}
        >
          <span className="absolute -top-2.5 -left-1 rounded bg-surface-container px-1.5 font-mono text-[11px] text-on-surface-variant">
            {moneyWhole(target)}
          </span>
        </div>
      )}
      <div className={`absolute inset-0 grid grid-cols-4 items-end gap-6 pr-2 ${target > 0 ? "pl-10" : "pl-2"}`}>
        {weeks.map((w) => (
          <div key={w.start.toISOString()} className="flex flex-col items-center gap-2">
            {w.current && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">Now</span>
            )}
            <span className={`font-mono text-xs ${w.current ? "font-semibold text-primary" : "text-on-surface-variant"}`}>
              {moneyWhole(w.amount)}
            </span>
            <div
              className={`w-full rounded-t-lg ${w.current ? "bg-primary" : "bg-surface-container-high"}`}
              style={{ height: Math.max(2, (w.amount / max) * h) }}
            />
            <span className={`text-xs ${w.current ? "font-semibold text-primary" : "text-on-surface-variant"}`}>
              {label(w.start)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
