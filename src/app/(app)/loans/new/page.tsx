"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ChevronDown, CircleCheck, CreditCard, NotebookPen, UserRound } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateTimePicker } from "@/components/DateTimePicker";
import { sanitizeAmount } from "@/components/AmountForm";
import { DEFAULT_PAYMENT_METHOD, paymentMethods } from "@/lib/data";
import { LOAN_SOURCES, loanSourceLabels, loanStatus, type LoanDirection, type LoanSource } from "@/lib/loans";
import { errorMessage, useAppData, type LoanInput } from "@/lib/store";
import { availableBalance, shortfall } from "@/lib/balance";
import { BalanceNotice, ShortfallText } from "@/components/BalanceNotice";
import { CURRENCY_SYMBOL, money } from "@/lib/format";

const MAX_AMOUNT = 10_000_000_000; // keep in sync with src/lib/api.ts

/** yyyy-mm-dd for <input type="date"> in local time. */
const toDateInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function NewLoanPage() {
  return (
    <Suspense>
      <LoanForm />
    </Suspense>
  );
}

function LoanForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { loans, addLoan, updateLoan, transactions, transfers, settings } = useAppData();

  const editId = params.get("id");
  const existing = editId ? loans.find((l) => l.id === editId) : undefined;
  const isEdit = Boolean(existing);

  const [direction, setDirection] = useState<LoanDirection>(
    existing?.direction ?? (params.get("dir") === "borrowed" ? "borrowed" : "lent"),
  );
  const [person, setPerson] = useState(existing?.person ?? "");
  const [source, setSource] = useState<LoanSource>(existing?.source ?? "friend");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [totalDue, setTotalDue] = useState(existing && existing.totalDue !== existing.amount ? String(existing.totalDue) : "");
  const [when, setWhen] = useState(() => (existing ? new Date(existing.date) : new Date()));
  const [account, setAccount] = useState(existing?.account ?? DEFAULT_PAYMENT_METHOD);
  const [dueDate, setDueDate] = useState(toDateInput(existing?.dueDate));
  const [monthly, setMonthly] = useState(Boolean(existing?.monthlyPayment));
  const [monthlyPayment, setMonthlyPayment] = useState(existing?.monthlyPayment ? String(existing.monthlyPayment) : "");
  const [paymentDay, setPaymentDay] = useState(existing?.paymentDay ?? 5);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const value = Number.parseFloat(amount) || 0;
  const total = totalDue ? Number.parseFloat(totalDue) || 0 : value;
  const lent = direction === "lent";
  const accountOptions = paymentMethods.includes(account) ? paymentMethods : [account, ...paymentMethods];
  // Lending takes money out of your balance: warn (non-blocking) if it's more than you have.
  // When editing, ignore this loan's own effect so it isn't counted twice.
  const available = availableBalance(transactions, transfers, loans, settings, { loanId: existing?.id });
  const short = lent ? shortfall(available, value, when, settings.balanceAsOf) : null;

  function validate(): string | null {
    if (!person.trim()) return lent ? "Who did you lend to?" : "Who did you borrow from?";
    if (value <= 0) return "Enter the amount.";
    if (value > MAX_AMOUNT || total > MAX_AMOUNT) return "That amount is too large.";
    if (totalDue && total < value) return "Total to repay can't be less than the amount.";
    if (monthly) {
      const m = Number.parseFloat(monthlyPayment) || 0;
      if (m <= 0) return "Enter the monthly payment, or turn off the monthly plan.";
      if (m > total) return "Monthly payment can't be more than the total to repay.";
    }
    if (dueDate && new Date(`${dueDate}T23:59:59`) < when) return "Repay-by date can't be before the loan date.";
    if (existing && total + 0.005 < loanStatus(existing).paid)
      return `Total can't be less than the ${money(loanStatus(existing).paid)} already repaid.`;
    return null;
  }

  const payload = (): LoanInput => ({
    direction,
    person: person.trim(),
    source,
    amount: value,
    totalDue: total,
    date: when.toISOString(),
    // End of the chosen day, local time.
    dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
    monthlyPayment: monthly ? Number.parseFloat(monthlyPayment) : undefined,
    paymentDay: monthly ? paymentDay : undefined,
    account,
    note: note.trim() || undefined,
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        await updateLoan(existing.id, payload());
        router.push(`/loans/${existing.id}`);
      } else {
        const created = await addLoan(payload());
        router.push(`/loans/${created.id}`);
      }
    } catch (e) {
      setError(errorMessage(e, "Could not save the loan."));
      setSaving(false);
      setConfirm(false);
    }
  }

  function onSaveClick() {
    if (saving) return;
    const err = validate();
    if (err) return setError(err);
    if (isEdit) setConfirm(true);
    else save();
  }

  if (editId && !existing && !saving) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Loan not found</p>
          <Link href="/loans" className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
            Back to loans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-4 bg-surface-container-lowest/90 px-5 py-4 backdrop-blur">
        <Link href={existing ? `/loans/${existing.id}` : "/loans"} aria-label="Back" className="rounded-full p-2 hover:bg-surface-container">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">{isEdit ? "Edit loan" : "Lend / Borrow"}</h1>
        <UserMenu />
      </header>

      <main className="space-y-5 px-5 pt-2">
        <div role="tablist" className="grid grid-cols-2 rounded-full bg-surface-container-high p-1.5">
          {(["lent", "borrowed"] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={direction === d}
              onClick={() => setDirection(d)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 transition ${
                direction === d ? "bg-surface-container-lowest font-semibold shadow-sm" : "text-on-surface-variant"
              }`}
            >
              {d === "lent" ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownLeft className="size-4" aria-hidden />}
              {d === "lent" ? "I lent" : "I borrowed"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <section className="card px-6 py-6 text-center">
          <label htmlFor="loan-amount" className="label-caps text-on-surface-variant">
            {lent ? "Amount given" : "Amount received"}
          </label>
          <div className="mt-2 flex items-baseline justify-center text-5xl font-bold tracking-tight tabular-nums">
            <span className="mr-1 text-4xl font-semibold text-outline">{CURRENCY_SYMBOL}</span>
            <input
              id="loan-amount"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus={!isEdit}
              value={amount}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
              className="bg-transparent caret-primary outline-none placeholder:font-semibold placeholder:text-outline-variant"
              style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
            />
          </div>
          <label className="mx-auto mt-4 flex max-w-64 items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
            <span className="shrink-0 text-on-surface-variant">Total to repay</span>
            <span className="text-outline">{CURRENCY_SYMBOL}</span>
            <input
              inputMode="decimal"
              placeholder={amount || "same"}
              value={totalDue}
              onChange={(e) => setTotalDue(sanitizeAmount(e.target.value))}
              className="w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:text-outline"
            />
          </label>
          <p className="mt-1 text-xs text-on-surface-variant">Only if interest or fees make it more than the amount.</p>
          {short && (
            <div className="mt-3">
              <BalanceNotice>
                <ShortfallText available={short.available} after={short.after} verb="Lending this" />
              </BalanceNotice>
            </div>
          )}
        </section>

        {/* Who */}
        <section className="card space-y-3 p-4">
          <label className="flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
              <UserRound className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="label-caps block text-on-surface-variant">{lent ? "Lent to" : "Borrowed from"}</span>
              <input
                value={person}
                maxLength={60}
                onChange={(e) => setPerson(e.target.value)}
                placeholder={lent ? "e.g. Ravi" : "e.g. KreditBee, HDFC, Mom"}
                className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
              />
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LOAN_SOURCES.map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => setSource(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                  source === s ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high"
                }`}
              >
                {loanSourceLabels[s]}
              </button>
            ))}
          </div>
        </section>

        {/* When / how */}
        <section className="card space-y-3 p-4">
          <DateTimePicker label={lent ? "Lent on" : "Borrowed on"} value={when} onChange={setWhen} />
          <label className="relative flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
              <CreditCard className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="label-caps block text-on-surface-variant">{lent ? "Paid via" : "Received via"}</span>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full appearance-none bg-transparent text-lg outline-none"
              >
                {accountOptions.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </span>
            <ChevronDown className="pointer-events-none size-5 text-on-surface-variant" aria-hidden />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-4 py-3">
            <span className="label-caps text-on-surface-variant">Repay by (optional)</span>
            <input
              type="date"
              value={dueDate}
              min={toDateInput(when.toISOString())}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent text-right outline-none"
            />
          </label>
        </section>

        {/* Monthly plan */}
        <section className="card p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">Monthly repayment plan</span>
              <span className="text-sm text-on-surface-variant">Repaid in instalments, e.g. ₹2,000 on the 5th</span>
            </span>
            <input
              type="checkbox"
              checked={monthly}
              onChange={(e) => setMonthly(e.target.checked)}
              className="size-5 accent-[var(--color-primary)]"
            />
          </label>
          {monthly && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2">
                <span className="text-outline">{CURRENCY_SYMBOL}</span>
                <input
                  inputMode="decimal"
                  placeholder="per month"
                  aria-label="Monthly payment"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(sanitizeAmount(e.target.value))}
                  className="w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:text-outline"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                <span className="text-on-surface-variant">on day</span>
                <select
                  aria-label="Payment day of month"
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(Number(e.target.value))}
                  className="flex-1 bg-transparent tabular-nums outline-none"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        <label className="card flex items-center gap-4 p-4">
          <NotebookPen className="size-5 shrink-0 text-on-surface-variant" aria-hidden />
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full bg-transparent outline-none placeholder:text-outline"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
            {error}
          </p>
        )}

        <button
          onClick={onSaveClick}
          disabled={saving}
          className="flex w-full items-center gap-3 rounded-xl bg-primary px-6 py-5 text-on-primary shadow-lg shadow-primary/25 transition hover:bg-primary-container disabled:opacity-50"
        >
          <CircleCheck className="size-6" aria-hidden />
          <span className="flex-1 text-left text-xl font-semibold">
            {saving && !isEdit ? "Saving…" : isEdit ? "Save changes" : lent ? "Save loan given" : "Save loan taken"}
          </span>
          <span className="rounded-full bg-primary-container px-4 py-1 text-lg tabular-nums">{money(value)}</span>
        </button>

        <ConfirmDialog
          open={confirm}
          title="Save changes to this loan?"
          message={
            <>
              {lent ? "Lent to" : "Borrowed from"} <b className="text-on-surface">{person.trim()}</b>,{" "}
              <b className="tabular-nums text-on-surface">{money(value)}</b>
              {total !== value && (
                <>
                  {" "}
                  (repay <b className="tabular-nums text-on-surface">{money(total)}</b>)
                </>
              )}
              . Existing repayments are kept.
            </>
          }
          busy={saving}
          onCancel={() => setConfirm(false)}
          onConfirm={save}
        />
      </main>
    </div>
  );
}
