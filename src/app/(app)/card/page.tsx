"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, CalendarClock, CreditCard, Pencil, ReceiptText, Trash2, Wallet } from "lucide-react";
import { AppHeader, ProgressBar } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { sanitizeAmount } from "@/components/AmountForm";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { TransferRow } from "@/components/TransferRow";
import { errorMessage, useAppData } from "@/lib/store";
import { cardSummary, currentCardDue, type CardSettings, type CardSummary } from "@/lib/creditCard";
import type { Transaction } from "@/lib/data";
import type { Transfer } from "@/lib/transfers";
import { CURRENCY_SYMBOL, dayMonth, money, plural } from "@/lib/format";

const MAX_AMOUNT = 10_000_000_000; // keep in sync with src/lib/api.ts
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export default function CardPage() {
  const { settings, transactions, transfers } = useAppData();
  const [editing, setEditing] = useState(false);
  const card = settings.card;

  return (
    <>
      <AppHeader subtitle="Credit Card" />
      <TabPage>
        {!card || editing ? (
          <section className="card space-y-4 p-5 motion-safe:animate-[ledgerly-fade-up_0.4s_ease-out_both]">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-md shadow-primary/30">
                <CreditCard className="size-6" aria-hidden />
              </span>
              <div>
                <h1 className="text-lg font-semibold">{card ? "Edit your card" : "Set up your credit card"}</h1>
                <p className="text-sm text-on-surface-variant">Track your bill, due date and what you owe.</p>
              </div>
            </div>
            {!card && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
                <li>Expenses paid with &quot;Credit Card&quot; still count as spending in the month you buy.</li>
                <li>They don&apos;t reduce your available balance until you pay the bill.</li>
                <li>Pay the bill with a transfer from Bank / UPI / Cash to Credit Card.</li>
              </ul>
            )}
            <CardSetupForm initial={card ?? undefined} onDone={() => setEditing(false)} onCancel={card ? () => setEditing(false) : undefined} />
            {!card && (
              <OwedHint due={currentCardDue(transactions, transfers, settings)} />
            )}
          </section>
        ) : (
          <CardOverview card={card} onEdit={() => setEditing(true)} />
        )}

        <Link
          href="/transfer"
          className="card flex items-center gap-3 px-5 py-4 text-sm font-medium transition hover:bg-surface-container-low"
        >
          <ArrowLeftRight className="size-5 text-primary" aria-hidden />
          <span className="flex-1">Transfer between your accounts</span>
          <span className="text-on-surface-variant">Open</span>
        </Link>
      </TabPage>
    </>
  );
}

function OwedHint({ due }: { due: number }) {
  if (due <= 0) return null;
  return (
    <p className="rounded-lg bg-surface-container-low px-3 py-2.5 text-sm text-on-surface-variant">
      Right now you owe <b className="tabular-nums text-on-surface">{money(due)}</b> on the card (from the amount you
      entered with your balance and card expenses since).
    </p>
  );
}

function CardSetupForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: CardSettings;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { saveCard } = useAppData();
  const [statementDay, setStatementDay] = useState(initial?.statementDay ?? 15);
  const [dueDay, setDueDay] = useState(initial?.dueDay ?? 5);
  const [limit, setLimit] = useState(initial?.limit ? String(initial.limit) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitValue = limit ? Number.parseFloat(limit) : undefined;
  const localError =
    statementDay === dueDay
      ? "Due day must be different from the statement day."
      : limitValue !== undefined && (!(limitValue > 0) || limitValue > MAX_AMOUNT)
        ? limitValue > MAX_AMOUNT
          ? "That limit is too large."
          : "Credit limit must be more than zero (or leave it empty)."
        : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (localError || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveCard({ statementDay, dueDay, ...(limitValue ? { limit: Math.round(limitValue * 100) / 100 } : {}) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not save the card."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <DaySelect label="Statement day" value={statementDay} onChange={setStatementDay} />
        <DaySelect label="Bill due day" value={dueDay} onChange={setDueDay} />
      </div>
      <p className="px-1 text-xs text-on-surface-variant">
        The bill closes at the end of the statement day. It&apos;s due on the due day of the{" "}
        {dueDay > statementDay ? "same" : "next"} month.
      </p>
      <label className="block rounded-lg bg-surface-container-low px-4 py-3">
        <span className="label-caps block text-on-surface-variant">Credit limit (optional)</span>
        <span className="flex items-center gap-1 text-lg tabular-nums">
          <span className="text-outline">{CURRENCY_SYMBOL}</span>
          <input
            inputMode="decimal"
            value={limit}
            placeholder="e.g. 50000"
            onChange={(e) => setLimit(sanitizeAmount(e.target.value))}
            className="w-full bg-transparent outline-none placeholder:text-outline"
          />
        </span>
      </label>
      {(localError || error) && (
        <p role="alert" className="text-sm text-secondary">
          {localError ?? error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full bg-surface-container px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          disabled={busy || Boolean(localError)}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : initial ? "Save card" : "Set up card"}
        </button>
      </div>
    </form>
  );
}

function DaySelect({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block rounded-lg bg-surface-container-low px-4 py-3">
      <span className="label-caps block text-on-surface-variant">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none bg-transparent text-lg tabular-nums outline-none"
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {ordinal(d)} of the month
          </option>
        ))}
      </select>
    </label>
  );
}

function CardOverview({ card, onEdit }: { card: CardSettings; onEdit: () => void }) {
  const { settings, transactions, transfers, saveCard } = useAppData();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = cardSummary(transactions, transfers, card, settings);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await saveCard(null);
      setConfirmRemove(false);
    } catch (e) {
      setError(errorMessage(e, "Could not remove the card."));
    } finally {
      setBusy(false);
    }
  }

  const payAmount = s.billOutstanding > 0 ? s.billOutstanding : s.due > 0 ? s.due : 0;
  const payHref = `/transfer?from=bank&to=card&amount=${payAmount.toFixed(2)}`;

  return (
    <>
      {/* Hero: bill to pay */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm motion-safe:animate-[ledgerly-fade-up_0.4s_ease-out_both]">
        <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Bill to pay</span>
            <DueBadge s={s} />
          </div>
          <p
            className={`text-[36px] leading-[44px] font-bold tracking-[-0.03em] tabular-nums ${
              s.overdue ? "text-secondary" : "text-on-surface"
            }`}
          >
            {money(s.billOutstanding)}
          </p>
          <p className="text-sm text-on-surface-variant">
            {s.billed > 0 ? (
              <>
                Statement of {dayMonth(s.lastStatement)}: <b className="tabular-nums text-on-surface">{money(s.billed)}</b>
                {s.billOutstanding === 0 && " · paid"}
              </>
            ) : (
              <>No bill from the statement of {dayMonth(s.lastStatement)}.</>
            )}
          </p>
          {payAmount > 0 && (
            <Link
              href={payHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:bg-primary-container"
            >
              <Wallet className="size-5" aria-hidden />
              {s.billOutstanding > 0 ? "Pay bill" : "Pay early"} <span className="tabular-nums">{money(payAmount)}</span>
            </Link>
          )}
        </div>
      </section>

      {/* Unbilled / total due */}
      <section className="grid grid-cols-2 gap-2">
        <div className="card p-4">
          <p className="text-xs font-medium text-on-surface-variant">Unbilled</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(s.unbilled)}</p>
          <p className="text-xs text-on-surface-variant">Next statement {dayMonth(s.nextStatement)}</p>
        </div>
        <div className="card p-4">
          {s.credit > 0 ? (
            <>
              <p className="text-xs font-medium text-on-surface-variant">Card credit</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-primary">{money(s.credit)}</p>
              <p className="text-xs text-on-surface-variant">You paid more than you owe</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-on-surface-variant">Total due</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-secondary">{money(s.due)}</p>
              <p className="text-xs text-on-surface-variant">Billed + unbilled</p>
            </>
          )}
        </div>
      </section>

      {card.limit && s.utilization !== null && (
        <section className="card space-y-2 p-5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">Credit limit</span>
            <span
              className={`tabular-nums font-semibold ${s.utilization >= 0.8 ? "text-tertiary" : "text-on-surface-variant"}`}
            >
              {Math.round(s.utilization * 100)}% used
            </span>
          </div>
          <ProgressBar value={s.utilization} tone={s.utilization >= 0.8 ? "tertiary" : "primary"} />
          <div className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-on-surface-variant">
            <span>
              <b className="text-on-surface">{money(Math.max(0, s.due))}</b> of {money(card.limit)}
            </span>
            <span>{money(Math.max(0, card.limit - Math.max(0, s.due)))} available</span>
          </div>
        </section>
      )}

      <EventList
        title="This cycle (unbilled)"
        sub={`Since ${dayMonth(new Date(s.lastStatement.getTime() + 1))}`}
        events={s.unbilledEvents}
        transactions={transactions}
        transfers={transfers}
        empty="No card activity since the last statement."
      />
      <EventList
        title="Last statement"
        sub={`Closed ${dayMonth(s.lastStatement)}`}
        events={s.billedEvents}
        transactions={transactions}
        transfers={transfers}
        empty="Nothing on the last statement."
      />

      <section className="card space-y-3 p-5">
        <div className="flex items-start gap-3 text-sm text-on-surface-variant">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            Statement on the <b className="text-on-surface">{ordinal(card.statementDay)}</b>, bill due on the{" "}
            <b className="text-on-surface">{ordinal(card.dueDay)}</b>
            {card.limit ? (
              <>
                , limit <b className="tabular-nums text-on-surface">{money(card.limit)}</b>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 rounded-full bg-surface-container py-2.5 text-sm font-medium"
          >
            <Pencil className="size-4" aria-hidden /> Edit card
          </button>
          <button
            onClick={() => {
              setError(null);
              setConfirmRemove(true);
            }}
            className="flex items-center justify-center gap-2 rounded-full bg-secondary-fixed py-2.5 text-sm font-medium text-secondary"
          >
            <Trash2 className="size-4" aria-hidden /> Remove card
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemove}
        danger
        title="Remove your credit card?"
        message={
          <>
            Your statement and due-date setup is removed. Card expenses and transfers are kept.
            {error && (
              <span role="alert" className="mt-2 block text-secondary">
                {error}
              </span>
            )}
          </>
        }
        confirmLabel="Yes, remove"
        busy={busy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
    </>
  );
}

function DueBadge({ s }: { s: CardSummary }) {
  if (s.billOutstanding <= 0) {
    return (
      <span className="label-caps rounded-full bg-primary-fixed/50 px-2.5 py-1 text-primary normal-case">All paid</span>
    );
  }
  if (s.overdue) {
    return (
      <span className="label-caps rounded-full bg-secondary-fixed px-2.5 py-1 text-secondary normal-case tabular-nums">
        Overdue · due {dayMonth(s.dueDate)}
      </span>
    );
  }
  const when = s.daysToDue === 0 ? "today" : s.daysToDue === 1 ? "tomorrow" : `in ${plural(s.daysToDue, "day")}`;
  return (
    <span
      className={`label-caps rounded-full px-2.5 py-1 normal-case tabular-nums ${
        s.daysToDue <= 5 ? "bg-tertiary-fixed text-tertiary" : "bg-surface-container text-on-surface-variant"
      }`}
    >
      Due {dayMonth(s.dueDate)} · {when}
    </span>
  );
}

function EventList({
  title,
  sub,
  events,
  transactions,
  transfers,
  empty,
}: {
  title: string;
  sub: string;
  events: CardSummary["unbilledEvents"];
  transactions: Transaction[];
  transfers: Transfer[];
  empty: string;
}) {
  const txById = new Map(transactions.map((t) => [t.id, t]));
  const trById = new Map(transfers.map((t) => [t.id, t]));
  const rows = events.flatMap((e) => {
    if (e.kind === "purchase" || e.kind === "refund") {
      const t = txById.get(e.id);
      return t ? [<TransactionRow key={`tx-${t.id}`} t={t} />] : [];
    }
    const t = trById.get(e.id);
    return t ? [<TransferRow key={`tr-${t.id}`} t={t} />] : [];
  });
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-on-surface-variant">{sub}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Nothing here" body={empty} />
      ) : (
        <ul className="card divide-y divide-surface-container overflow-hidden px-5">{rows}</ul>
      )}
    </section>
  );
}
