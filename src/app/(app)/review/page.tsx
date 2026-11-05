"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronsDown, ChevronsUp, Inbox } from "lucide-react";
import { BalanceNotice } from "@/components/BalanceNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateTimePicker } from "@/components/DateTimePicker";
import { EmptyState } from "@/components/TransactionRow";
import { SubHeader } from "@/components/ui";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { sanitizeAmount } from "@/components/AmountForm";
import { possibleDuplicate, suggestCategory, type CapturedItem } from "@/lib/captureMatch";
import { categories, moreCategories, paymentMethods, primaryCategories, type CategoryId } from "@/lib/data";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { errorMessage, useAppData } from "@/lib/store";
import { TRANSFER_ACCOUNTS, transferAccountLabels, transferHint, type TransferAccount } from "@/lib/transfers";

type Kind = "expense" | "income" | "transfer";

const initialKind = (item: CapturedItem): Kind =>
  item.kind === "income" ? "income" : item.kind === "expense" ? "expense" : "transfer";

export default function ReviewPage() {
  const { captured } = useAppData();
  const list = useViewAll(captured);
  return (
    <div className="pb-10">
      <SubHeader title="To review" backHref="/" />
      <main className="space-y-4 px-5 pt-2 md:px-8">
        {captured.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing to review"
            body="Bank alerts from Gmail will appear here. They only count once you add them."
            action={
              <Link href="/capture" className="rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
                Gmail auto-capture
              </Link>
            }
          />
        ) : (
          <>
            <p className="px-1 text-sm text-on-surface-variant">Check each one, then add it. Nothing counts in your totals until you do.</p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              {list.shown.map((item) => (
                <ReviewCard key={item.id} item={item} />
              ))}
            </div>
            <ViewAllButton list={list} />
          </>
        )}
      </main>
    </div>
  );
}

function ReviewCard({ item }: { item: CapturedItem }) {
  const { transactions, transfers, captured, confirmCaptured, dismissCaptured } = useAppData();
  const [kind, setKind] = useState<Kind>(initialKind(item));
  const [amount, setAmount] = useState(item.amount.toFixed(2));
  const [merchant, setMerchant] = useState(item.merchant ?? "");
  const [category, setCategory] = useState<CategoryId | null>(() => suggestCategory(item.merchant, transactions));
  const [showMore, setShowMore] = useState(() => category !== null && moreCategories.includes(category));
  const [account, setAccount] = useState(item.account ?? "");
  const [from, setFrom] = useState<TransferAccount>("bank");
  const [to, setTo] = useState<TransferAccount>(item.kind === "atmWithdrawal" ? "cash" : "card");
  const [when, setWhen] = useState(() => new Date(item.receivedAt));
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number.parseFloat(amount) || 0;
  const duplicate = possibleDuplicate(item, transactions, transfers, captured);
  const missing =
    value <= 0
      ? "Enter the amount"
      : kind === "transfer"
        ? from === to
          ? "From and To must be different"
          : null
        : kind === "expense" && !category
          ? "Choose a category"
          : !account
            ? "Choose the payment method"
            : null;

  async function add() {
    if (missing || busy) return;
    setBusy(true);
    setError(null);
    const name = merchant.trim();
    try {
      await confirmCaptured(
        item.id,
        kind === "transfer"
          ? { type: "transfer", from, to, amount: value, date: when.toISOString(), note: name || undefined }
          : {
              type: "transaction",
              merchant: name || (kind === "income" ? "Income" : categories[category!].long),
              category: kind === "income" ? "income" : category!,
              amount: kind === "income" ? value : -value,
              date: when.toISOString(),
              account,
            },
      );
    } catch (e) {
      setError(errorMessage(e, "Could not add this alert."));
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      await dismissCaptured(item.id);
    } catch (e) {
      setError(errorMessage(e, "Could not remove this alert."));
      setBusy(false);
      setConfirmDismiss(false);
    }
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center gap-2">
        <div role="tablist" className="grid flex-1 grid-cols-3 rounded-full bg-surface-container-high p-1 text-sm">
          {(["expense", "income", "transfer"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full py-1.5 capitalize transition ${
                kind === k ? "bg-surface-container-lowest font-semibold shadow-sm" : "text-on-surface-variant"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-center text-4xl font-bold tracking-tight tabular-nums">
        <span className="mr-1 text-2xl font-semibold text-outline">{CURRENCY_SYMBOL}</span>
        <input
          aria-label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          className="bg-transparent caret-primary outline-none"
          style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
        />
      </div>

      {duplicate && (
        <BalanceNotice>
          Possible duplicate: the same amount was recorded within a day. Check before adding.
        </BalanceNotice>
      )}

      <label className="block rounded-lg bg-surface-container-low px-4 py-3">
        <span className="label-caps block text-on-surface-variant">{kind === "income" ? "Source" : kind === "transfer" ? "Note" : "Merchant"}</span>
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          maxLength={120}
          placeholder="Optional"
          className="w-full bg-transparent outline-none placeholder:text-outline"
        />
      </label>

      {kind === "expense" && (
        <div className="grid grid-cols-4 gap-2">
          {(showMore ? [...primaryCategories, ...moreCategories] : primaryCategories).map((id) => {
            const { label, icon: Icon } = categories[id];
            const on = id === category;
            return (
              <button
                key={id}
                aria-pressed={on}
                onClick={() => setCategory(id)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-xs sm:aspect-auto sm:py-3 leading-tight transition ${
                  on ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}
          <button
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border sm:aspect-auto sm:py-3 border-dashed border-outline-variant px-1 text-center text-xs leading-tight font-medium text-primary"
          >
            {showMore ? <ChevronsUp className="size-5" aria-hidden /> : <ChevronsDown className="size-5" aria-hidden />}
            {showMore ? "Show less" : "Show more"}
          </button>
        </div>
      )}

      {kind === "transfer" ? (
        <div className="space-y-3">
          <AccountChips label="From" value={from} onChange={setFrom} />
          <AccountChips label="To" value={to} onChange={setTo} />
          {from !== to && <BalanceNotice tone="info">{transferHint({ from, to })}</BalanceNotice>}
        </div>
      ) : (
        <label className="block rounded-lg bg-surface-container-low px-4 py-3">
          <span className="label-caps block text-on-surface-variant">{kind === "expense" ? "Paid with" : "Received via"}</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full bg-transparent outline-none">
            {!account && <option value="">Choose…</option>}
            {paymentMethods.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      )}

      <DateTimePicker label="Date & Time" value={when} onChange={setWhen} />

      {error && (
        <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
          {error}
        </p>
      )}
      {missing && <p className="text-center text-sm text-on-surface-variant">{missing}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => setConfirmDismiss(true)}
          disabled={busy}
          className="flex-1 rounded-full py-3 font-medium text-secondary hover:bg-secondary-fixed/50 disabled:opacity-50"
        >
          Not a transaction
        </button>
        <button
          onClick={add}
          disabled={Boolean(missing) || busy}
          className="flex-1 rounded-full bg-primary py-3 font-medium text-on-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDismiss}
        title="Remove this alert?"
        message="It won't be added to your records, and this can't be undone."
        confirmLabel="Yes, remove"
        danger
        busy={busy}
        onCancel={() => setConfirmDismiss(false)}
        onConfirm={dismiss}
      />
    </section>
  );
}

function AccountChips({ label, value, onChange }: { label: string; value: TransferAccount; onChange: (a: TransferAccount) => void }) {
  return (
    <div>
      <p className="label-caps mb-1.5 text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-2">
        {TRANSFER_ACCOUNTS.map((a) => (
          <button
            key={a}
            aria-pressed={value === a}
            onClick={() => onChange(a)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              value === a ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container"
            }`}
          >
            {transferAccountLabels[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
