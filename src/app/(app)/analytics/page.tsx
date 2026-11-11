"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, TrendingDown, TrendingUp, Lightbulb, Download, ChartSpline } from "lucide-react";
import { AppHeader, IconTile } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { EmptyState } from "@/components/TransactionRow";
import type { CategoryId, CategoryInfo, Transaction } from "@/lib/data";
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
import { csvAmount, csvDateTime, downloadCsv, todayStamp } from "@/lib/csv";
import { CURRENCY_SYMBOL, money, moneyWhole } from "@/lib/format";

export default function Analytics() {
  const { transactions, budget, categoryOf } = useAppData();
  const [range, setRange] = useState<Range>("month");

  // Derived from the data and the range only, so hovering or tapping the ring doesn't recompute them.
  const current = useMemo(() => within(transactions, periodBounds(range)), [transactions, range]);
  const previous = useMemo(() => within(transactions, periodBounds(range, new Date(), 1)), [transactions, range]);
  const total = useMemo(() => totalSpent(current), [current]);
  const prevTotal = useMemo(() => totalSpent(previous), [previous]);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const [whole, cents] = money(total).replace(CURRENCY_SYMBOL, "").split(".");
  const breakdown = useMemo(() => spentByCategory(current), [current]);
  // Ring: top 7 categories + "More categories" (rest folded), coloured in ring order from a
  // colour-blind-checked palette. `active` = hovered/tapped slice key, or null (nothing focused).
  const slices = useMemo(() => ringSlices(breakdown, categoryOf), [breakdown, categoryOf]);
  const [active, setActive] = useState<string | null>(null);
  const activeSlice = slices.find((sl) => sl.key === active) ?? null;
  const shown = activeSlice ?? slices[0];
  const chartRef = useRef<HTMLDivElement>(null);
  // Tap/click anywhere outside the chart + list clears the selection.
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!chartRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);
  const merchantList = useMemo(() => topMerchants(current, Infinity), [current]);
  const merchants = useViewAll(merchantList);
  const legend = useViewAll(slices);
  const weeks = useMemo(() => weeklySpend(transactions), [transactions]);
  const weekTarget = budget.monthlyLimit > 0 ? (budget.monthlyLimit * 12) / 52 : 0;
  const insight = useMemo(() => categoryInsight(transactions), [transactions]);
  const monthBudgetDelta = range === "month" && budget.monthlyLimit > 0 ? budget.monthlyLimit - total : null;

  return (
    <>
      <AppHeader subtitle="Analytics" />
      <TabPage>
        <div role="tablist" className="grid grid-cols-3 rounded-full bg-surface-container-high p-1.5 md:max-w-sm">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
          {/* Total */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <p className="label-caps text-on-surface-variant">Total spent this {range}</p>
              <CalendarDays className="size-5 text-on-surface-variant" aria-hidden />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-4xl font-bold tracking-tight min-[360px]:text-5xl">
                <span className="mr-1 align-middle text-2xl font-normal text-on-surface-variant">{CURRENCY_SYMBOL}</span>
                {whole}.{cents}
              </p>
              {change !== null && (
                <span
                  className={`flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 tabular-nums text-sm font-semibold ${
                    change <= 0 ? "text-primary" : "text-secondary"
                  }`}
                >
                  {change <= 0 ? <TrendingDown className="size-4" aria-hidden /> : <TrendingUp className="size-4" aria-hidden />}
                  {Math.abs(Math.round(change))}%
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
              <span className="text-on-surface-variant">
                Previous {range}: <b className="tabular-nums text-on-surface">{money(prevTotal)}</b>
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
                  on {categoryOf(insight.category).long.toLowerCase()} this month than last month.
                </p>
              </div>
            </section>
          )}
        </div>
        {/* Guard on expenses (not all transactions): an income-only period has nothing to chart. */}
        {breakdown.length === 0 || !shown ? (
          <EmptyState
            icon={ChartSpline}
            title={`No spending this ${range}`}
            body="Once you add expenses, your category breakdown and top merchants will appear here."
          />
        ) : (
          <section className="card p-5">
            <h2 className="text-[22px] font-semibold tracking-tight">Category Breakdown</h2>
            <p className="text-sm text-on-surface-variant">Where your money went this {range}</p>
            <div ref={chartRef} className="md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:items-center md:gap-8">
              <div>
                <div className="relative mx-auto my-6 aspect-square w-full max-w-56">
                  <Donut slices={slices} total={total} active={active} onActive={setActive} />
                  {/* Centre label: focused slice, otherwise the top category. Doesn't block the ring. */}
                  <div className="pointer-events-none absolute inset-0 grid place-content-center px-10 text-center" aria-live="polite">
                    <p className="label-caps text-on-surface-variant">{activeSlice ? "Selected" : "Top Category"}</p>
                    <p className="text-lg leading-tight font-semibold">{shown.label}</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-on-surface-variant">
                      {pct(shown.amount, total)} · {money(shown.amount)}
                    </p>
                  </div>
                </div>
                <p className="-mt-3 mb-3 text-center text-xs text-on-surface-variant">Tap or hover a slice to see its category.</p>
              </div>
              {/* Legend: one row per slice, same colours and order as the ring */}
              <div className="min-w-0">
                <ul className="divide-y divide-surface-container rounded-xl bg-surface-container-low px-4">
                  {legend.shown.map((sl) => {
                    const share = total > 0 ? sl.amount / total : 0;
                    const dim = activeSlice && activeSlice.key !== sl.key;
                    return (
                      <li
                        key={sl.key}
                        {...focusHandlers(sl.key, setActive)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={activeSlice?.key === sl.key}
                        className={`cursor-pointer py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary transition-opacity duration-150 ${dim ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="size-3 shrink-0 rounded-full" style={{ background: sl.color }} aria-hidden />
                          <span className="min-w-0 flex-1 text-sm font-medium break-words">
                            {sl.label}
                            {sl.members && (
                              <span className="block text-xs font-normal text-on-surface-variant">
                                {sl.members.map((m) => categoryOf(m).long).join(", ")}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums">{money(sl.amount)}</span>
                            <span className="block text-xs tabular-nums text-on-surface-variant">{pct(sl.amount, total)}</span>
                          </span>
                        </div>
                        <div className="mt-2 ml-6 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: sl.color }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <ViewAllButton list={legend} />
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] lg:items-start">
          {breakdown.length > 0 && (
            <section className="card p-5">
              <h2 className="text-[22px] font-semibold tracking-tight">Top Merchants</h2>
              <p className="mb-4 text-sm text-on-surface-variant">Highest spending this {range}</p>
              <ul className="space-y-2">
                {merchants.shown.map((m) => (
                  <li key={m.name} className="flex items-center gap-4 rounded-lg bg-surface-container-low p-4">
                    <IconTile icon={categoryOf(m.category).icon} tone={categoryOf(m.category).tone} round size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.name}</p>
                      <p className="text-sm text-on-surface-variant">
                        {m.count} {m.count === 1 ? "transaction" : "transactions"} • {categoryOf(m.category).long}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums font-semibold">-{money(m.amount)}</p>
                      <p className="text-xs text-on-surface-variant">{Math.round((m.amount / total) * 100)}% of total</p>
                    </div>
                  </li>
                ))}
              </ul>
              <ViewAllButton list={merchants} />
            </section>
          )}

          {/* Weekly trend (always last 4 weeks) */}
          <section className="card p-5">
            <h2 className="text-[22px] font-semibold tracking-tight">Weekly Spending Trend</h2>
            <p className="text-sm text-on-surface-variant">
              Last 4 weeks{weekTarget > 0 && `, paced against ${money(weekTarget)}/wk from your budget`}
            </p>
            <WeeklyBars weeks={weeks} target={weekTarget} />
          </section>
        </div>

        <button
          onClick={() => downloadTransactionsCsv(transactions, categoryOf)}
          disabled={transactions.length === 0}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-surface-container-low py-4 disabled:opacity-50 md:mx-auto md:w-fit md:px-8"
        >
          <Download className="size-5" aria-hidden /> Download Transactions (CSV)
        </button>
      </TabPage>
    </>
  );
}

/** Transactions CSV: readable local dates, plain-number amounts (expense negative), newest first. */
function downloadTransactionsCsv(list: Transaction[], categoryOf: (id: string) => CategoryInfo) {
  const rows = [
    ["Date", "Type", "Merchant / note", "Category", "Payment method", "Amount (INR)"],
    ...[...list]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .map((t) => [
        csvDateTime(t.date),
        t.amount < 0 ? "Expense" : "Income",
        t.merchant,
        categoryOf(t.category).long,
        t.account ?? "",
        csvAmount(t.amount),
      ]),
  ];
  downloadCsv(`ledgerly-transactions-${todayStamp()}.csv`, rows);
}

/**
 * Ring palette, applied in ring order (largest slice first). Values live in globals.css (`--color-chart-*`).
 * Light slots < 3:1 contrast are fine because every slice has a visible text label in the legend.
 */
const RING_COLORS = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--color-chart-${n})`);
const MORE_COLOR = "var(--color-chart-more)"; // neutral grey for the folded "More categories" slice

type Slice = { key: string; label: string; amount: number; color: string; members?: CategoryId[] };

/** Top 7 categories by spend get palette slots; the rest fold into one "More categories" slice. */
function ringSlices(breakdown: { category: CategoryId; amount: number }[], categoryOf: (id: string) => CategoryInfo): Slice[] {
  const top = breakdown.slice(0, RING_COLORS.length).map((b, i) => ({
    key: b.category,
    label: categoryOf(b.category).long,
    amount: b.amount,
    color: RING_COLORS[i],
  }));
  const rest = breakdown.slice(RING_COLORS.length);
  if (rest.length === 0) return top;
  if (rest.length === 1) {
    return [...top, { key: rest[0].category, label: categoryOf(rest[0].category).long, amount: rest[0].amount, color: MORE_COLOR }];
  }
  return [
    ...top,
    {
      key: "__more__",
      label: `More categories (${rest.length})`,
      amount: rest.reduce((s, r) => s + r.amount, 0),
      color: MORE_COLOR,
      members: rest.map((r) => r.category),
    },
  ];
}

type SetActive = (k: string | null | ((prev: string | null) => string | null)) => void;

/**
 * Focus behaviour per input type (a phone tap fires hover+focus+click, so they must not fight):
 * mouse → hover focuses, leaving resets; touch/pen → tap toggles; keyboard → focus-visible focuses,
 * Enter/Space toggles, blur resets.
 */
function focusHandlers(key: string, setActive: SetActive) {
  return {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setActive(key);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setActive(null);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") setActive((a) => (a === key ? null : key));
    },
    onFocus: (e: React.FocusEvent<Element>) => {
      if (e.currentTarget.matches(":focus-visible")) setActive(key);
    },
    onBlur: () => setActive((a) => (a === key ? null : a)),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive((a) => (a === key ? null : key));
      } else if (e.key === "Escape") setActive(null);
    },
  };
}

const pct = (part: number, total: number) => {
  const p = total > 0 ? (part / total) * 100 : 0;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
};

function Donut({
  slices,
  total,
  active,
  onActive,
}: {
  slices: Slice[];
  total: number;
  active: string | null;
  onActive: SetActive;
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 1.4 : 0; // small surface gap between slices (flat ends, no overlap)
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible" aria-label="Spending by category">
      {slices.map((sl) => {
        const len = (sl.amount / total) * c;
        const isActive = active === sl.key;
        const dim = active !== null && !isActive;
        const el = (
          <circle
            key={sl.key}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={sl.color}
            strokeWidth={isActive ? 15 : 11}
            strokeDasharray={`${Math.max(0.01, len - gap)} ${c}`}
            strokeDashoffset={-offset}
            opacity={dim ? 0.3 : 1}
            role="button"
            tabIndex={0}
            aria-label={`${sl.label}: ${money(sl.amount)}, ${pct(sl.amount, total)}`}
            aria-pressed={isActive}
            {...focusHandlers(sl.key, onActive)}
            className="cursor-pointer outline-none transition-[stroke-width,opacity] duration-200 ease-out"
          >
            <title>{`${sl.label}: ${money(sl.amount)}`}</title>
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
          <span className="absolute -top-2.5 -left-1 rounded bg-surface-container px-1.5 tabular-nums text-[11px] text-on-surface-variant">
            {moneyWhole(target)}
          </span>
        </div>
      )}
      <div className={`absolute inset-0 grid grid-cols-4 items-end gap-6 pr-2 ${target > 0 ? "pl-14" : "pl-2"}`}>
        {weeks.map((w) => (
          <div key={w.start.toISOString()} className="flex flex-col items-center gap-2">
            {w.current && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">Now</span>
            )}
            <span className={`tabular-nums text-xs ${w.current ? "font-semibold text-primary" : "text-on-surface-variant"}`}>
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
