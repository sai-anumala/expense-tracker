"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeftRight,
  Banknote,
  CircleCheck,
  CreditCard,
  IndianRupee,
  Info,
  Landmark,
  NotebookPen,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { AppHeader, PageColumns, RowHint } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateTimePicker } from "@/components/DateTimePicker";
import { sanitizeAmount } from "@/components/AmountForm";
import { EmptyState } from "@/components/TransactionRow";
import { TransferRow } from "@/components/TransferRow";
import { errorMessage, useAppData } from "@/lib/store";
import { periodBounds } from "@/lib/insights";
import { CURRENCY_SYMBOL, money, plural } from "@/lib/format";
import { BalanceNotice, ShortfallText } from "@/components/BalanceNotice";
import { availableBalance, shortfall } from "@/lib/balance";
import { transferCashEffect } from "@/lib/creditCard";
import {
  TRANSFER_ACCOUNTS,
  isCardAdvance,
  isCardBill,
  transferAccountLabels,
  transferHint,
  transferPrefill,
  transferRoute,
  transferTotals,
  type TransferAccount,
} from "@/lib/transfers";

const MAX_AMOUNT = 10_000_000_000; // keep in sync with src/lib/api.ts

const accountIcons: Record<TransferAccount, LucideIcon> = {
  bank: Landmark,
  upi: Smartphone,
  cash: Banknote,
  card: CreditCard,
};

export default function TransferPage() {
  return (
    <Suspense>
      <TransferScreen />
    </Suspense>
  );
}

function TransferScreen() {
  const params = useSearchParams();
  const editId = params.get("id");
  // Defaults for a NEW transfer can come from the URL (e.g. "Pay bill" on the Credit Card screen).
  const prefill = transferPrefill((k) => params.get(k));
  const prefillKey = `${prefill.from}-${prefill.to}-${prefill.amount}`;
  // Remount the form when switching between "new" and a specific transfer so its fields reset.
  return <TransferForm key={editId ?? `new-${prefillKey}`} editId={editId} prefill={prefill} />;
}

function TransferForm({
  editId,
  prefill,
}: {
  editId: string | null;
  prefill: { from: TransferAccount; to: TransferAccount; amount: string };
}) {
  const router = useRouter();
  const { transfers, addTransfer, updateTransfer, transactions, loans, settings } = useAppData();
  const existing = editId ? transfers.find((t) => t.id === editId) : undefined;
  const history = useViewAll(transfers);
  const isEdit = Boolean(existing);

  const [from, setFrom] = useState<TransferAccount>(existing?.from ?? prefill.from);
  const [to, setTo] = useState<TransferAccount>(existing?.to ?? prefill.to);
  const [amount, setAmount] = useState(existing ? existing.amount.toFixed(2) : prefill.amount);
  const [when, setWhen] = useState(() => (existing ? new Date(existing.date) : new Date()));
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const value = Number.parseFloat(amount) || 0;
  const tooLarge = value > MAX_AMOUNT;
  const canSave = value > 0 && !tooLarge && from !== to && !saving;
  const month = transferTotals(transfers, periodBounds("month"));
  // Paying the card bill takes cash out of the available balance: warn (non-blocking) if it's more than you have.
  // When editing, ignore this transfer's old effect so it isn't counted twice.
  const cashOut = Math.max(0, -transferCashEffect({ from, to, amount: value }));
  // Walks every transaction, transfer and loan: recompute only when the data changes, not on every keystroke.
  const available = useMemo(
    () => availableBalance(transactions, transfers, loans, settings, { transferId: existing?.id }),
    [transactions, transfers, loans, settings, existing?.id],
  );
  const short = shortfall(available, cashOut, when, settings.balanceAsOf);

  // Picking the current "To" account as "From" swaps them, so From and To are never the same.
  const pickFrom = (a: TransferAccount) => {
    if (a === to) setTo(from);
    setFrom(a);
  };
  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const payload = () => ({ from, to, amount: value, date: when.toISOString(), note: note.trim() || undefined });

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      if (isEdit && editId) {
        await updateTransfer(editId, payload());
        router.replace("/transfer");
        return;
      }
      await addTransfer(payload());
      setSaved(`Saved ${transferRoute({ from, to })}, ${money(value)}.`);
      setAmount("");
      setNote("");
      setWhen(new Date());
    } catch (e) {
      setError(errorMessage(e, isEdit ? "Could not update the transfer." : "Could not save the transfer."));
      setConfirm(false);
    }
    setSaving(false);
  }

  function onSaveClick() {
    if (!canSave) return;
    if (isEdit) setConfirm(true); // edits need a "Yes" confirmation
    else save();
  }

  if (editId && !existing && !saving) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Transfer not found</p>
          <p className="mt-1 text-sm text-on-surface-variant">It may have been deleted.</p>
          <Link
            href="/transfer"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary"
          >
            Back to transfers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader subtitle={isEdit ? "Edit transfer" : "Transfer"} />
      <TabPage>
        <PageColumns>
          <div className="min-w-0 space-y-6">
            <Illustration from={from} to={to} />

            <section className="card space-y-4 p-4">
              <AccountChips label="From" value={from} onPick={pickFrom} />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap From and To"
                  className="grid size-9 place-items-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
                >
                  <ArrowDownUp className="size-4" aria-hidden />
                </button>
              </div>
              <AccountChips label="To" value={to} disabled={from} onPick={setTo} />
              {(isCardBill({ from, to }) || isCardAdvance({ from, to })) && (
                <p className="flex items-start gap-2 rounded-lg bg-info-container px-3 py-2.5 text-sm text-on-info-container">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {transferHint({ from, to })}
                </p>
              )}
            </section>

            <section className="card px-6 py-6 text-center">
              <label htmlFor="amount" className="label-caps text-on-surface-variant">
                Amount moved
              </label>
              <div className="mt-2 flex items-baseline justify-center font-sans text-5xl font-bold tracking-tight tabular-nums">
                <span className="mr-1 text-4xl font-semibold text-outline">{CURRENCY_SYMBOL}</span>
                <input
                  id="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  aria-invalid={tooLarge}
                  onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
                  className="bg-transparent caret-primary outline-none placeholder:font-semibold placeholder:text-outline-variant"
                  style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
                />
              </div>
              {tooLarge && (
                <p role="alert" className="mt-3 text-sm text-secondary">
                  That amount is too large.
                </p>
              )}
              {short && !tooLarge && (
                <div className="mt-3">
                  <BalanceNotice>
                    <ShortfallText available={short.available} after={short.after} verb="This card bill payment" />
                  </BalanceNotice>
                </div>
              )}
            </section>

            <section className="card space-y-3 p-4">
              <DateTimePicker label="Date & Time" value={when} onChange={setWhen} />
              <label className="relative flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
                  <NotebookPen className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="label-caps block text-on-surface-variant">Note (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. ATM withdrawal"
                    className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
                  />
                </span>
              </label>
            </section>

            {error && (
              <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="rounded-lg bg-primary-fixed/50 px-4 py-3 text-sm text-primary">
                {saved}
              </p>
            )}

            <button
              onClick={onSaveClick}
              disabled={!canSave}
              className="flex w-full items-center gap-3 rounded-xl bg-primary px-6 py-5 text-on-primary shadow-lg shadow-primary/25 transition hover:bg-primary-container disabled:opacity-50"
            >
              <CircleCheck className="size-6" aria-hidden />
              <span className="flex-1 text-left text-xl font-semibold">
                {saving && !isEdit ? "Saving…" : isEdit ? "Save changes" : "Save transfer"}
              </span>
              <span className="rounded-full bg-primary-container px-4 py-1 tabular-nums text-lg">{money(value)}</span>
            </button>
            {isEdit && (
              <Link href="/transfer" className="block text-center text-sm font-medium text-on-surface-variant">
                Cancel editing
              </Link>
            )}
          </div>

          {/* History */}
          <section className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-[22px] font-semibold tracking-tight">Your transfers</h2>
              <span className="text-right text-xs tabular-nums text-on-surface-variant">
                This month: {plural(month.count, "transfer")} · {money(month.amount)}
              </span>
            </div>
            {transfers.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No transfers yet"
                body="Record money you move between your bank, UPI, cash and credit card, like paying the card bill. It never counts as spending."
              />
            ) : (
              <>
                <RowHint noun="transfer" actions="view, edit or delete" className="mb-1 px-1" />
                <ul className="card divide-y divide-surface-container overflow-hidden px-5">
                  {history.shown.map((t) => (
                    <TransferRow key={t.id} t={t} />
                  ))}
                </ul>
                <ViewAllButton list={history} />
              </>
            )}
          </section>
        </PageColumns>

        <ConfirmDialog
          open={confirm}
          title="Save changes to this transfer?"
          message={
            <>
              It will be updated to <b className="text-on-surface">{transferRoute({ from, to })}</b>,{" "}
              <b className="tabular-nums text-on-surface">{money(value)}</b>.
            </>
          }
          busy={saving}
          onCancel={() => setConfirm(false)}
          onConfirm={save}
        />
      </TabPage>
    </>
  );
}

function AccountChips({
  label,
  value,
  disabled,
  onPick,
}: {
  label: string;
  value: TransferAccount;
  disabled?: TransferAccount;
  onPick: (a: TransferAccount) => void;
}) {
  return (
    <fieldset>
      <legend className="label-caps mb-2 px-1 text-on-surface-variant">{label}</legend>
      <div className="grid grid-cols-4 gap-2">
        {TRANSFER_ACCOUNTS.map((a) => {
          const Icon = accountIcons[a];
          const on = a === value;
          const off = a === disabled;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              disabled={off}
              title={off ? "Already chosen as From" : undefined}
              onClick={() => onPick(a)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-center text-[13px] leading-tight transition ${
                on
                  ? "bg-primary text-on-primary"
                  : off
                    ? "bg-surface-container-low text-outline-variant"
                    : "bg-surface-container-low hover:bg-surface-container"
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {transferAccountLabels[a]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Compact animated header: coins travelling from the From account to the To account (motion-safe). */
function Illustration({ from, to }: { from: TransferAccount; to: TransferAccount }) {
  const FromIcon = accountIcons[from];
  const ToIcon = accountIcons[to];
  return (
    <section className="relative overflow-hidden rounded-xl bg-surface-container-lowest px-5 py-4 shadow-sm">
      <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative mx-auto h-14 max-w-60" aria-hidden>
        <svg className="absolute top-1/2 left-10 h-2 w-[calc(100%-5rem)] -translate-y-1/2" viewBox="0 0 100 2" preserveAspectRatio="none">
          <line
            x1="0"
            y1="1"
            x2="100"
            y2="1"
            stroke="var(--color-outline-variant)"
            strokeWidth="2"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="motion-safe:animate-[ledgerly-dash_0.8s_linear_infinite]"
          />
        </svg>
        <span className="absolute top-1/2 left-0 grid size-12 -translate-y-1/2 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/30">
          <FromIcon className="size-6" />
        </span>
        <span className="absolute top-1/2 right-0 grid size-12 -translate-y-1/2 place-items-center rounded-2xl bg-primary-container text-on-primary shadow-md shadow-primary/30">
          <ToIcon className="size-6" />
        </span>
        {[0, 1.2].map((delay) => (
          <span
            key={delay}
            className="absolute top-1/2 left-[8%] grid size-6 place-items-center rounded-full bg-coin text-on-coin opacity-0 shadow-md motion-safe:animate-[ledgerly-travel_2.4s_ease-in-out_infinite] motion-reduce:hidden"
            style={{ animationDelay: `${delay}s` }}
          >
            <IndianRupee className="size-3.5" strokeWidth={2.5} />
          </span>
        ))}
      </div>
      <p className="relative mt-3 text-center text-sm text-on-surface-variant">
        Move money between your own accounts. It&apos;s never counted as income or spending. Only paying the credit
        card bill (or taking cash from the card) changes your available balance.
      </p>
    </section>
  );
}
