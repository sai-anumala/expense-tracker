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
  HandCoins,
  CreditCard,
  ChevronRight,
  Lightbulb,
  ReceiptText,
  Pencil,
  X,
} from "lucide-react";
import { BalanceForm } from "@/components/BalanceForm";
import { BalanceNotice } from "@/components/BalanceNotice";
import { AppHeader, MonthPill, ProgressBar } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { TransferRow } from "@/components/TransferRow";
import { useAppData } from "@/lib/store";
import { categories, type Transaction } from "@/lib/data";
import { mergeFeed, type FeedItem } from "@/lib/transfers";
import { loanTotals } from "@/lib/loans";
import { availableCashEvents, cardSummary, currentCardDue, needsCardDuePrompt, type CardSummary } from "@/lib/creditCard";
import { anchoredBalance, categoryInsight, net, periodBounds, totalIncome, totalSpent, within } from "@/lib/insights";
import { dayBucket, dayMonth, daysLeftInMonth, plural, money, monthLabel } from "@/lib/format";

const quickActions: { label: string; icon: typeof CirclePlus; href: string; accent?: boolean }[] = [
  { label: "Add Expense", icon: CirclePlus, href: "/add", accent: true },
  { label: "Add Income", icon: Banknote, href: "/add?kind=income" },
  { label: "Credit Card", icon: CreditCard, href: "/card" },
  { label: "Lend / Borrow", icon: HandCoins, href: "/loans/new" },
];

export default function Dashboard() {
  const { transactions, budget, settings, saveSettings, loans, transfers } = useAppData();
  const [tipOpen, setTipOpen] = useState(true);
  const [editingOpening, setEditingOpening] = useState(false);

  const [monthStart] = periodBounds("month");
  const thisMonth = within(transactions, periodBounds("month"));

  // Total Available Balance (Bank + UPI + Cash) = entered balance + cash events dated at/after it was entered
  // (see anchoredBalance). Card purchases don't count; card bill payments do. Loans move cash too, but never
  // count as income or spending (lib/creditCard.ts availableCashEvents).
  const opening = settings.openingBalance;
  const asOf = settings.balanceAsOf ? new Date(settings.balanceAsOf) : null;
  const { balance, base } = anchoredBalance(
    availableCashEvents(transactions, transfers, loans),
    opening,
    settings.balanceAsOf,
    monthStart,
  );
  // Credit Card card: what's owed, shown on its own. Never subtracted from the balance above.
  const card = settings.card ? cardSummary(transactions, transfers, settings.card, settings) : null;
  // One-time prompt for balances entered before the card model (unpaid card amount never entered).
  const askCardDue = needsCardDuePrompt(transactions, transfers, settings);
  const cardDueNow = Math.max(0, currentCardDue(transactions, transfers, settings));
  const loanSum = loanTotals(loans);
  const growth = base !== null && base > 0 ? ((balance - base) / base) * 100 : null;

  // Triad row: this month's cash flow. Remaining = monthly budget cap − spent this month.
  const income = totalIncome(thisMonth);
  const spent = totalSpent(thisMonth);
  const limit = budget.monthlyLimit;
  const toSpend = limit - spent;
  const used = limit > 0 ? spent / limit : 0;
  const daysLeft = daysLeftInMonth();
  const [whole, cents] = money(balance).split(".");
  const insight = categoryInsight(transactions);

  // Recent = latest 5 of transactions and transfers merged by date. Transfers are display-only here:
  // they never enter the balance, tiles or the day "net" below.
  const feed = mergeFeed(transactions, transfers);
  const groups = new Map<string, FeedItem<Transaction>[]>();
  for (const f of feed.slice(0, 5)) {
    const k = dayBucket(f.date);
    groups.set(k, [...(groups.get(k) ?? []), f]);
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
                {opening !== null && !editingOpening && (
                  <button
                    aria-label="Update total available balance"
                    title="Update total available balance"
                    onClick={() => setEditingOpening(true)}
                    className="rounded-full p-1 text-outline hover:bg-surface-container hover:text-on-surface"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
              </span>
              {growth !== null && Math.abs(growth) >= 0.05 && !editingOpening && (
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

            {opening === null || editingOpening ? (
              <div>
                <p className="text-sm text-on-surface-variant">
                  How much money do you have right now in your bank, UPI and cash? From this moment on, income you
                  record adds to it and spending subtracts from it. Credit card purchases don&apos;t; paying the card
                  bill does. Transactions dated earlier won&apos;t change it.
                </p>
                <BalanceForm
                  initialBalance={opening === null ? undefined : Math.round(balance * 100) / 100}
                  initialCardDue={cardDueNow > 0 ? cardDueNow : undefined}
                  onCancel={opening !== null ? () => setEditingOpening(false) : undefined}
                  onSave={async (v) => {
                    await saveSettings(v); // errors are shown by BalanceForm
                    setEditingOpening(false);
                  }}
                />
              </div>
            ) : (
              <div
                className="flex items-baseline gap-1"
                title={
                  asOf
                    ? `Set to ${money(opening ?? 0)} on ${asOf.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}; updated by transactions dated from then on`
                    : undefined
                }
              >
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
            )}

            {askCardDue && !editingOpening && (
              <BalanceNotice tone="info">
                Card purchases no longer reduce your balance. Update your balance and enter what&apos;s unpaid on your
                card.{" "}
                <button
                  type="button"
                  onClick={() => setEditingOpening(true)}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  Update balance
                </button>
              </BalanceNotice>
            )}

            {/* Triad metrics: this month */}
            <div className="grid grid-cols-3 gap-1 pt-1">
              <Metric icon={ArrowDown} label="Income" value={`+${money(income)}`} tone="primary" />
              <Metric icon={ArrowUp} label="Spent" value={`-${money(spent)}`} tone="secondary" />
              <Metric
                icon={PiggyBank}
                label="Remaining"
                value={limit > 0 ? `${toSpend < 0 ? "-" : ""}${money(toSpend)}` : "—"}
                tone={toSpend < 0 ? "secondary" : "neutral"}
                title={
                  limit > 0
                    ? `${money(limit)} monthly budget − ${money(spent)} spent this month`
                    : "Set a monthly budget to see how much is remaining"
                }
              />
            </div>
          </div>
        </section>

        {(card || cardDueNow > 0) && <CreditCardSummary card={card} dueNow={cardDueNow} />}

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
              <span className="shrink-0 rounded-full bg-primary-fixed/50 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                {Math.round(used * 100)}% used
              </span>
            )}
          </div>
          {limit > 0 ? (
            <>
              <ProgressBar value={used} tone={used < 0.9 ? "primary" : "tertiary"} />
              {/* Spent / cap: app font with tabular digits; wraps on very narrow screens */}
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs tabular-nums text-on-surface-variant sm:text-sm">
                <span>
                  <b className="font-semibold text-on-surface">{money(spent)}</b> spent
                </span>
                <span>
                  of <b className="font-semibold text-on-surface">{money(limit)}</b> cap
                </span>
              </div>
              {/* Daily pace + days left: separate pill so they never collide on mobile */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
                  <Clock className="size-4 shrink-0 text-tertiary" aria-hidden />
                  <span>
                    Daily safe pace{" "}
                    <b className="font-semibold whitespace-nowrap tabular-nums text-on-surface">
                      {money(Math.max(0, toSpend) / daysLeft)}/day
                    </b>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 font-medium whitespace-nowrap tabular-nums text-on-surface-variant">
                  {plural(daysLeft, "day")} left
                </span>
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

        {/* Loans summary (only when there are open loans) */}
        {(loanSum.lentOpen > 0 || loanSum.borrowedOpen > 0) && (
          <Link href="/loans" className="card grid grid-cols-2 divide-x divide-surface-container p-0 transition hover:bg-surface-container-low">
            <div className="p-4">
              <p className="text-xs font-medium text-on-surface-variant">You&apos;ll get</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-primary">{money(loanSum.toReceive)}</p>
              <p className="text-xs text-on-surface-variant">{plural(loanSum.lentOpen, "loan")} given</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-on-surface-variant">You owe</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-secondary">{money(loanSum.toPay)}</p>
              <p className="text-xs text-on-surface-variant">{plural(loanSum.borrowedOpen, "loan")} taken</p>
            </div>
          </Link>
        )}

        {/* Quick actions */}
        <section>
          <h2 className="label-caps mb-3 px-1 text-on-surface-variant">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(({ label, icon: Icon, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="card relative flex flex-col items-center gap-2 px-1 py-4 text-center text-sm transition hover:-translate-y-0.5"
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
            {feed.length > 0 && (
              <Link href="/accounts" className="flex items-center text-sm font-medium text-primary">
                View All <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {feed.length > 0 && (
            <p className="mb-1 px-1 text-xs text-on-surface-variant">Swipe a transaction left (or tap it) to view, edit or delete.</p>
          )}
          {feed.length === 0 ? (
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
              // Net of transactions only: transfers move money between own accounts (net zero).
              const dayTx = list.flatMap((f) => (f.kind === "transaction" ? [f.item] : []));
              const dayNet = net(dayTx);
              return (
                <div key={day} className="mt-4">
                  <div className="label-caps mb-2 flex justify-between px-1 text-on-surface-variant">
                    <span>{day}</span>
                    {dayTx.length > 0 && (
                      <span className={`tabular-nums normal-case ${dayNet > 0 ? "text-primary" : ""}`}>
                        {dayNet < 0 ? "-" : "+"}
                        {money(dayNet)}
                        {dayNet > 0 && " net"}
                      </span>
                    )}
                  </div>
                  <ul className="card divide-y divide-surface-container overflow-hidden px-5">
                    {list.map((f) =>
                      f.kind === "transfer" ? (
                        <TransferRow key={`tr-${f.item.id}`} t={f.item} />
                      ) : (
                        <TransactionRow key={f.item.id} t={f.item} />
                      ),
                    )}
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

/** Overview "Credit Card" card: total owed on the card (or card credit), with the bill breakdown. Links to /card. */
function CreditCardSummary({ card, dueNow }: { card: CardSummary | null; dueNow: number }) {
  const credit = card?.credit ?? 0;
  const owed = card ? Math.max(0, card.due) : dueNow;
  const overdue = card?.overdue ?? false;

  let detail: string;
  if (!card) detail = "Set up your card to see bill dates";
  else if (credit > 0) detail = "You've paid more than you owe";
  else if (owed === 0) detail = "Nothing to pay";
  else
    detail = [
      card.billOutstanding > 0
        ? `Bill ${money(card.billOutstanding)} ${overdue ? "overdue since" : "due"} ${dayMonth(card.dueDate)}`
        : null,
      card.unbilled > 0 ? `Unbilled ${money(card.unbilled)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Link href="/card" className="card flex items-center gap-3 p-4 transition hover:bg-surface-container-low">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-container">
        <CreditCard className="size-5 text-primary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-on-surface-variant">
          {credit > 0 ? "Credit Card · Card credit" : "Credit Card · You owe"}
        </span>
        <span
          className={`block text-lg font-bold tabular-nums ${
            overdue ? "text-secondary" : credit > 0 ? "text-primary" : "text-on-surface"
          }`}
        >
          {money(credit > 0 ? credit : owed)}
        </span>
        <span className={`block text-xs tabular-nums ${overdue ? "text-secondary" : "text-on-surface-variant"}`}>{detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-outline" aria-hidden />
    </Link>
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
      <span className={`truncate pt-1 text-[13px] font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
