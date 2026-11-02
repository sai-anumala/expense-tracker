"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HandCoins, CalendarClock, ChevronRight, Download } from "lucide-react";
import { AppHeader, ProgressBar } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState } from "@/components/TransactionRow";
import { useAppData } from "@/lib/store";
import { loanSourceLabels, loanStatus, loanTotals, type Loan } from "@/lib/loans";
import { money, plural } from "@/lib/format";
import { downloadCsv, todayStamp } from "@/lib/csv";
import { loansSummaryRows } from "@/lib/loanExport";

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function Loans() {
  const { loans } = useAppData();
  const [tab, setTab] = useState<"open" | "settled">("open");
  const totals = loanTotals(loans);

  const withStatus = loans.map((l) => ({ l, s: loanStatus(l) }));
  const shown = withStatus
    .filter(({ s }) => (tab === "open" ? !s.settled : s.settled))
    // Open: overdue first, then nearest due/next payment, then newest.
    .sort((a, b) => {
      if (a.s.overdue !== b.s.overdue) return a.s.overdue ? -1 : 1;
      const da = a.s.nextPayment ?? (a.l.dueDate ? new Date(a.l.dueDate) : null);
      const db = b.s.nextPayment ?? (b.l.dueDate ? new Date(b.l.dueDate) : null);
      if (da && db) return +da - +db;
      if (da || db) return da ? -1 : 1;
      return +new Date(b.l.date) - +new Date(a.l.date);
    });
  const settledCount = withStatus.filter(({ s }) => s.settled).length;

  return (
    <>
      <AppHeader subtitle="Loans" />
      <TabPage>
        {/* Summary */}
        <section className="grid grid-cols-2 gap-2">
          <div className="card p-4">
            <p className="flex items-center gap-1 text-xs font-medium text-on-surface-variant">
              <ArrowDownLeft className="size-3.5 text-primary" aria-hidden /> You&apos;ll get
            </p>
            <p className="mt-1 truncate text-xl font-bold tabular-nums text-primary">{money(totals.toReceive)}</p>
            <p className="text-xs text-on-surface-variant">{plural(totals.lentOpen, "open loan")} given</p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-1 text-xs font-medium text-on-surface-variant">
              <ArrowUpRight className="size-3.5 text-secondary" aria-hidden /> You owe
            </p>
            <p className="mt-1 truncate text-xl font-bold tabular-nums text-secondary">{money(totals.toPay)}</p>
            <p className="text-xs text-on-surface-variant">{plural(totals.borrowedOpen, "open loan")} taken</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/loans/new?dir=lent"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-on-primary"
          >
            <ArrowUpRight className="size-4" aria-hidden /> I lent money
          </Link>
          <Link
            href="/loans/new?dir=borrowed"
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-high py-3 font-semibold"
          >
            <ArrowDownLeft className="size-4" aria-hidden /> I borrowed
          </Link>
        </div>
        <p className="-mt-3 px-1 text-xs text-on-surface-variant">
          Loans change your Total Available Balance but never count as income or spending.
        </p>

        <button
          onClick={() => downloadCsv(`ledgerly-loans-${todayStamp()}.csv`, loansSummaryRows(loans))}
          disabled={loans.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant py-2.5 text-sm font-medium transition hover:bg-surface-container-low disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden /> Download all loans (CSV)
        </button>

        <div role="tablist" className="grid grid-cols-2 rounded-full bg-surface-container-high p-1.5">
          {(["open", "settled"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full py-2 capitalize transition ${
                tab === t ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant"
              }`}
            >
              {t === "open" ? `Open (${loans.length - settledCount})` : `Settled (${settledCount})`}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={tab === "open" ? "No open loans" : "No settled loans yet"}
            body={
              tab === "open"
                ? "Record money you lend to someone or borrow from a friend, relative, app or bank."
                : "Loans move here once they're fully repaid."
            }
          />
        ) : (
          <ul className="space-y-2">
            {shown.map(({ l, s }) => (
              <li key={l.id}>
                <LoanCard loan={l} status={s} />
              </li>
            ))}
          </ul>
        )}
      </TabPage>
    </>
  );
}

function LoanCard({ loan, status }: { loan: Loan; status: ReturnType<typeof loanStatus> }) {
  const lent = loan.direction === "lent";
  return (
    <Link href={`/loans/${loan.id}`} className="card block p-4 transition hover:bg-surface-container-low">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${
            lent ? "bg-primary-fixed/50 text-primary" : "bg-secondary-fixed text-secondary"
          }`}
        >
          {lent ? <ArrowUpRight className="size-5" aria-hidden /> : <ArrowDownLeft className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{loan.person}</p>
          <p className="truncate text-xs text-on-surface-variant">
            {lent ? "You lent" : "You borrowed"} · {loanSourceLabels[loan.source]} · {shortDate(loan.date)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-bold tabular-nums ${status.settled ? "text-on-surface-variant" : lent ? "text-primary" : "text-secondary"}`}>
            {status.settled ? "Settled" : money(status.outstanding)}
          </p>
          <p className="text-xs tabular-nums text-on-surface-variant">of {money(loan.totalDue)}</p>
        </div>
        <ChevronRight className="-mr-1 size-4 shrink-0 text-outline-variant" aria-hidden />
      </div>
      <div className="mt-3">
        <ProgressBar value={status.progress} tone={status.overdue ? "tertiary" : "primary"} />
      </div>
      {!status.settled && (status.overdue || status.nextPayment || loan.dueDate) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {status.overdue && <span className="rounded-full bg-secondary-fixed px-2 py-0.5 font-semibold text-secondary">Overdue</span>}
          {status.nextPayment && loan.monthlyPayment && (
            <span className="flex items-center gap-1 text-on-surface-variant">
              <CalendarClock className="size-3.5" aria-hidden />
              Next {money(Math.min(loan.monthlyPayment, status.outstanding))} · {shortDate(status.nextPayment)}
            </span>
          )}
          {loan.dueDate && <span className="text-on-surface-variant">Repay by {shortDate(loan.dueDate)}</span>}
        </p>
      )}
    </Link>
  );
}
