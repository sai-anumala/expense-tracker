"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Pencil,
  Trash2,
  BadgeCheck,
  Download,
} from "lucide-react";
import { PageColumns, ProgressBar, SubHeader } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateTimePicker, formatWhen } from "@/components/DateTimePicker";
import { sanitizeAmount } from "@/components/AmountForm";
import { DEFAULT_PAYMENT_METHOD, paymentMethods } from "@/lib/data";
import { loanSourceLabels, loanStatus, type LoanPayment } from "@/lib/loans";
import { errorMessage, useAppData } from "@/lib/store";
import { availableBalance, shortfall } from "@/lib/balance";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { BalanceNotice, ShortfallText } from "@/components/BalanceNotice";
import { CURRENCY_SYMBOL, money } from "@/lib/format";
import { downloadCsv, slug, todayStamp } from "@/lib/csv";
import { personStatementRows } from "@/lib/loanExport";

const longDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loans, removeLoan, addPayment, removePayment, transactions, transfers, settings } = useAppData();
  const loan = loans.find((l) => l.id === id);

  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(() => new Date());
  const [account, setAccount] = useState(DEFAULT_PAYMENT_METHOD);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPay, setConfirmPay] = useState(false);
  const [confirmDeleteLoan, setConfirmDeleteLoan] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<LoanPayment | null>(null);
  const [deleted, setDeleted] = useState(false);
  const repayments = useViewAll(loan?.payments ?? []);
  // Walks every transaction, transfer and loan: recompute only when the data changes, not on every keystroke.
  const available = useMemo(() => availableBalance(transactions, transfers, loans, settings), [transactions, transfers, loans, settings]);

  if (!loan) {
    if (deleted) return null; // navigating away after delete
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Loan not found</p>
          <p className="mt-1 text-sm text-on-surface-variant">It may have been deleted.</p>
          <Link href="/loans" className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
            Back to loans
          </Link>
        </div>
      </div>
    );
  }

  const s = loanStatus(loan);
  const lent = loan.direction === "lent";
  const value = Number.parseFloat(amount) || 0;
  const settlesIt = value > 0 && Math.abs(value - s.outstanding) < 0.005;
  const accountOptions = paymentMethods.includes(account) ? paymentMethods : [account, ...paymentMethods];
  // Repaying money you borrowed reduces your balance: warn (non-blocking) if it's more than you have.
  const short = !lent ? shortfall(available, value, when, settings.balanceAsOf) : null;

  function onRecord() {
    setError(null);
    if (value <= 0) return setError("Enter the repayment amount.");
    if (value > s.outstanding + 0.005) return setError(`That's more than the ${money(s.outstanding)} outstanding.`);
    if (when < new Date(loan!.date)) return setError("Repayment date can't be before the loan date.");
    setConfirmPay(true);
  }

  async function recordPayment() {
    setBusy(true);
    try {
      await addPayment(loan!.id, { amount: value, date: when.toISOString(), account, note: note.trim() || undefined });
      setAmount("");
      setNote("");
      setWhen(new Date());
      setConfirmPay(false);
    } catch (e) {
      setError(errorMessage(e, "Could not record the repayment."));
      setConfirmPay(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-10">
      <SubHeader title={loan.person} backHref="/loans" backLabel="Back to loans" />

      <main className="px-5 pt-2 md:px-8">
        <PageColumns>
          {/* Summary */}
          <div className="min-w-0">
            <section className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm">
              <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex items-center justify-between gap-3">
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    lent ? "bg-primary-fixed/50 text-primary" : "bg-secondary-fixed text-secondary"
                  }`}
                >
                  {lent ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownLeft className="size-3.5" aria-hidden />}
                  {lent ? "You lent" : "You borrowed"} · {loanSourceLabels[loan.source]}
                </span>
                {s.settled ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                    <BadgeCheck className="size-4" aria-hidden /> Settled
                  </span>
                ) : (
                  s.overdue && <span className="rounded-full bg-secondary-fixed px-2.5 py-1 text-xs font-semibold text-secondary">Overdue</span>
                )}
              </div>
              <p className="relative mt-4 text-xs font-medium text-on-surface-variant">
                {s.settled ? "Fully repaid" : lent ? "They still owe you" : "You still owe"}
              </p>
              <p className={`relative text-[36px] leading-[44px] font-bold tracking-[-0.03em] tabular-nums ${s.settled ? "text-on-surface-variant" : ""}`}>
                {money(s.outstanding)}
              </p>
              <div className="relative mt-3">
                <ProgressBar value={s.progress} tone={s.overdue ? "tertiary" : "primary"} />
              </div>
              <div className="relative mt-2 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-on-surface-variant">
                <span>
                  Repaid <b className="font-semibold text-on-surface">{money(s.paid)}</b>
                </span>
                <span>
                  of <b className="font-semibold text-on-surface">{money(loan.totalDue)}</b>
                  {loan.totalDue !== loan.amount && <> (amount {money(loan.amount)})</>}
                </span>
              </div>

              <dl className="relative mt-4 divide-y divide-surface-container rounded-xl bg-surface-container-low px-4 text-sm">
                <Row k={lent ? "Lent on" : "Borrowed on"} v={formatWhen(new Date(loan.date))} />
                {loan.account && <Row k={lent ? "Paid via" : "Received via"} v={loan.account} />}
                {loan.dueDate && <Row k="Repay by" v={longDate(loan.dueDate)} />}
                {loan.monthlyPayment && loan.paymentDay && (
                  <Row k="Monthly plan" v={`${money(loan.monthlyPayment)} on day ${loan.paymentDay}`} />
                )}
                {s.nextPayment && loan.monthlyPayment && (
                  <Row
                    k="Next payment"
                    v={`${money(Math.min(loan.monthlyPayment, s.outstanding))} · ${longDate(s.nextPayment)}`}
                    icon
                  />
                )}
                {loan.note && <Row k="Note" v={loan.note} />}
              </dl>
            </section>
          </div>
          <div className="min-w-0 space-y-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {/* Record repayment */}
            {!s.settled && (
              <section className="card space-y-3 p-4">
                <h2 className="font-semibold">{lent ? "Record money received back" : "Record a repayment you made"}</h2>
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-baseline gap-1 rounded-lg bg-surface-container-low px-3 py-2 text-2xl font-bold tabular-nums">
                    <span className="text-xl font-semibold text-outline">{CURRENCY_SYMBOL}</span>
                    <input
                      inputMode="decimal"
                      aria-label="Repayment amount"
                      placeholder={loan.monthlyPayment ? String(Math.min(loan.monthlyPayment, s.outstanding)) : "0.00"}
                      value={amount}
                      onChange={(e) => {
                        setError(null);
                        setAmount(sanitizeAmount(e.target.value));
                      }}
                      className="w-full min-w-0 bg-transparent outline-none placeholder:font-semibold placeholder:text-outline-variant"
                    />
                  </label>
                </div>
                {short && (
                  <BalanceNotice>
                    <ShortfallText available={short.available} after={short.after} verb="This repayment" />
                  </BalanceNotice>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAmount(String(s.outstanding))}
                    className="rounded-full bg-primary-fixed/50 px-3.5 py-1.5 text-sm font-semibold text-primary"
                  >
                    Settle in full · {money(s.outstanding)}
                  </button>
                  {loan.monthlyPayment && loan.monthlyPayment < s.outstanding && (
                    <button
                      onClick={() => setAmount(String(loan.monthlyPayment))}
                      className="rounded-full bg-surface-container px-3.5 py-1.5 text-sm"
                    >
                      Monthly · {money(loan.monthlyPayment)}
                    </button>
                  )}
                </div>
                <DateTimePicker label="Date" value={when} onChange={setWhen} />
                <label className="relative flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-4 py-3">
                  <span className="label-caps text-on-surface-variant">{lent ? "Received via" : "Paid via"}</span>
                  <select
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    className="appearance-none bg-transparent pr-6 text-right outline-none"
                  >
                    {accountOptions.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 size-4 text-on-surface-variant" aria-hidden />
                </label>
                <input
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full rounded-lg bg-surface-container-low px-4 py-3 outline-none placeholder:text-outline"
                />
                {error && (
                  <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
                    {error}
                  </p>
                )}
                <button
                  onClick={onRecord}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-on-primary disabled:opacity-50"
                >
                  <CircleCheck className="size-5" aria-hidden />
                  {settlesIt ? "Record & settle loan" : "Record repayment"}
                </button>
              </section>
            )}

            {/* History */}
            <section>
              <h2 className="mb-2 px-1 text-lg font-semibold">Repayments</h2>
              {loan.payments.length === 0 ? (
                <p className="card px-4 py-6 text-center text-sm text-on-surface-variant">No repayments yet.</p>
              ) : (
                <ul className="card divide-y divide-surface-container overflow-hidden">
                  {repayments.shown.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tabular-nums">{money(p.amount)}</p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {formatWhen(new Date(p.date))}
                          {p.account && ` · ${p.account}`}
                          {p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      <button
                        aria-label={`Remove repayment of ${money(p.amount)}`}
                        onClick={() => setDeletingPayment(p)}
                        className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ViewAllButton list={repayments} />
            </section>
          </div>
          <div className="min-w-0 space-y-5 lg:col-start-1">
            <button
              onClick={() =>
                downloadCsv(`ledgerly-${slug(loan.person)}-statement-${todayStamp()}.csv`, personStatementRows(loans, loan.person))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-3 font-medium transition hover:bg-surface-container-low"
            >
              <Download className="size-4 shrink-0" aria-hidden /> Download {loan.person}&apos;s statement (CSV)
            </button>
            {(() => {
              const others = loans.filter((l) => l.id !== loan.id && l.person.trim().toLowerCase() === loan.person.trim().toLowerCase()).length;
              return others > 0 ? (
                <p className="-mt-3 px-1 text-center text-xs text-on-surface-variant">
                  Includes {others} other {others === 1 ? "loan" : "loans"} with {loan.person}.
                </p>
              ) : null;
            })()}

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/loans/new?id=${loan.id}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-high py-3 font-medium"
              >
                <Pencil className="size-4" aria-hidden /> Edit loan
              </Link>
              <button
                onClick={() => setConfirmDeleteLoan(true)}
                className="flex items-center justify-center gap-2 rounded-xl py-3 font-medium text-secondary hover:bg-secondary-fixed/50"
              >
                <Trash2 className="size-4" aria-hidden /> Delete loan
              </button>
            </div>
          </div>
        </PageColumns>

        <ConfirmDialog
          open={confirmPay}
          title={settlesIt ? "Record repayment and settle this loan?" : "Record this repayment?"}
          message={
            <>
              <b className="tabular-nums text-on-surface">{money(value)}</b> {lent ? "received from" : "paid to"}{" "}
              <b className="text-on-surface">{loan.person}</b> on {formatWhen(when)}.
              {!settlesIt && (
                <>
                  {" "}
                  Remaining after this: <b className="tabular-nums text-on-surface">{money(s.outstanding - value)}</b>.
                </>
              )}
            </>
          }
          confirmLabel="Yes, record"
          busy={busy}
          onCancel={() => setConfirmPay(false)}
          onConfirm={recordPayment}
        />
        <ConfirmDialog
          open={deletingPayment !== null}
          title="Remove this repayment?"
          message={
            deletingPayment && (
              <>
                {money(deletingPayment.amount)} on {formatWhen(new Date(deletingPayment.date))} will be removed and the
                outstanding amount goes back up.
              </>
            )
          }
          confirmLabel="Yes, remove"
          danger
          busy={busy}
          onCancel={() => setDeletingPayment(null)}
          onConfirm={async () => {
            if (!deletingPayment) return;
            setBusy(true);
            try {
              await removePayment(loan.id, deletingPayment.id);
            } catch (e) {
              setError(errorMessage(e, "Could not remove the repayment."));
            } finally {
              setBusy(false);
              setDeletingPayment(null);
            }
          }}
        />
        <ConfirmDialog
          open={confirmDeleteLoan}
          title="Delete this loan?"
          message="The loan and all its repayments will be permanently removed, and your balance updated. This can't be undone."
          confirmLabel="Yes, delete"
          danger
          busy={busy}
          onCancel={() => setConfirmDeleteLoan(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              setDeleted(true);
              await removeLoan(loan.id);
              router.push("/loans");
            } catch (e) {
              setDeleted(false);
              setError(errorMessage(e, "Could not delete the loan."));
              setBusy(false);
              setConfirmDeleteLoan(false);
            }
          }}
        />
      </main>
    </div>
  );
}

function Row({ k, v, icon }: { k: string; v: string; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex items-center gap-1 text-on-surface-variant">
        {icon && <CalendarClock className="size-3.5" aria-hidden />}
        {k}
      </dt>
      <dd className="truncate text-right font-medium tabular-nums">{v}</dd>
    </div>
  );
}
