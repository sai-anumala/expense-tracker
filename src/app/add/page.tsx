"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  ChevronDown,
  NotebookPen,
  ImagePlus,
  CircleCheck,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateTimePicker } from "@/components/DateTimePicker";
import { categories, paymentMethods, pickableCategories, type CategoryId } from "@/lib/data";
import { errorMessage, useAppData } from "@/lib/store";
import { sanitizeAmount } from "@/components/AmountForm";
import { CURRENCY_SYMBOL, money, moneyWhole } from "@/lib/format";

type Kind = "expense" | "income";

const MAX_AMOUNT = 10_000_000_000; // keep in sync with src/lib/api.ts


export default function AddPage() {
  return (
    <Suspense>
      <AddTransaction />
    </Suspense>
  );
}

function AddTransaction() {
  const router = useRouter();
  const params = useSearchParams();
  const { add, update, remove, transactions } = useAppData();

  // ?id=… → edit an existing transaction; otherwise add a new one.
  const editId = params.get("id");
  const existing = editId ? transactions.find((t) => t.id === editId) : undefined;
  const isEdit = Boolean(existing);

  const [kind, setKind] = useState<Kind>(
    existing ? (existing.amount > 0 ? "income" : "expense") : params.get("kind") === "income" ? "income" : "expense",
  );
  const [amount, setAmount] = useState(existing ? Math.abs(existing.amount).toFixed(2) : "");
  const [category, setCategory] = useState<CategoryId>(
    existing && existing.category !== "income" ? existing.category : "food",
  );
  const [when, setWhen] = useState(() => (existing ? new Date(existing.date) : new Date()));
  const [account, setAccount] = useState(existing?.account ?? paymentMethods[0]);
  const [note, setNote] = useState(existing?.merchant ?? "");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"save" | "delete" | null>(null);

  const value = Number.parseFloat(amount) || 0;
  const tooLarge = value > MAX_AMOUNT;
  const bump = (n: number) => setAmount((value + n).toFixed(2));
  const accountOptions = paymentMethods.includes(account) ? paymentMethods : [account, ...paymentMethods];

  const payload = () => ({
    merchant: note.trim() || (kind === "income" ? "Income" : categories[category].long),
    category: kind === "income" ? ("income" as const) : category,
    amount: kind === "income" ? value : -value,
    date: when.toISOString(),
    account,
    receiptName: receipt ?? undefined,
  });

  async function run(action: () => Promise<void>, failMsg: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      router.push("/");
    } catch (e) {
      setError(errorMessage(e, failMsg));
      setSaving(false);
      setConfirm(null);
    }
  }

  function onSaveClick() {
    if (value <= 0 || tooLarge || saving) return;
    if (isEdit) setConfirm("save"); // edits need a "Yes" confirmation
    else run(() => add(payload()), "Could not save transaction.");
  }

  // While saving/deleting, the item may vanish from the list just before we navigate away.
  if (editId && !existing && !saving) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Transaction not found</p>
          <p className="mt-1 text-sm text-on-surface-variant">It may have been deleted.</p>
          <Link href="/" className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-4 bg-surface-container-lowest/90 px-5 py-4 backdrop-blur">
        <Link href="/" aria-label="Back" className="rounded-full p-2 hover:bg-surface-container">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">{isEdit ? "Edit Transaction" : "Add Transaction"}</h1>
        <Avatar />
      </header>

      <main className="space-y-6 px-5 pt-2">
        <div role="tablist" className="grid grid-cols-2 rounded-full bg-surface-container-high p-1.5">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full py-2.5 text-lg capitalize transition ${
                kind === k ? "bg-surface-container-lowest font-semibold shadow-sm" : "text-on-surface-variant"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <section className="card px-6 py-6 text-center">
          <label htmlFor="amount" className="label-caps text-on-surface-variant">
            Amount {kind === "expense" ? "Spent" : "Received"}
          </label>
          <div className="mt-2 flex items-center justify-center font-mono text-5xl font-semibold">
            <span className="text-outline">{CURRENCY_SYMBOL}</span>
            <input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus={!isEdit}
              value={amount}
              aria-invalid={tooLarge}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
              className="bg-transparent caret-primary outline-none placeholder:text-outline-variant"
              style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
            />
          </div>
          <div className="mt-4 flex justify-center gap-2 font-mono text-sm">
            {[100, 500, 1000].map((n) => (
              <button key={n} onClick={() => bump(n)} className="rounded-full bg-surface-container px-4 py-1.5">
                +{moneyWhole(n)}
              </button>
            ))}
            <button onClick={() => setAmount("")} className="rounded-full bg-surface-container px-4 py-1.5">
              Clear
            </button>
          </div>
          {tooLarge && (
            <p role="alert" className="mt-3 text-sm text-secondary">
              That amount is too large.
            </p>
          )}
        </section>

        {kind === "expense" && (
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[22px] font-semibold tracking-tight">Select Category</h2>
              <span className="text-sm font-medium text-primary">{categories[category].long}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {pickableCategories.map((id) => {
                const { label, icon: Icon } = categories[id];
                const on = id === category;
                return (
                  <button
                    key={id}
                    aria-pressed={on}
                    onClick={() => setCategory(id)}
                    className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-xl text-sm transition ${
                      on ? "bg-primary text-on-primary" : "card hover:bg-surface-container-low"
                    }`}
                  >
                    <Icon className="size-7" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="card space-y-3 p-4">
          <DateTimePicker label="Date & Time" value={when} onChange={setWhen} />
          <Field
            icon={CreditCard}
            label={kind === "expense" ? "Paid With" : "Received Via"}
            trailing={<ChevronDown className="size-5" aria-hidden />}
          >
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full appearance-none bg-transparent text-lg outline-none"
            >
              {accountOptions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field icon={NotebookPen} label={kind === "expense" ? "Note or Merchant" : "Source"}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder={kind === "expense" ? "e.g. Lunch with team" : "e.g. Salary"}
              className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
            />
          </Field>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg bg-surface-container-low py-4 text-lg">
            <ImagePlus className="size-5 text-primary" aria-hidden />
            <span className="truncate">{receipt ?? "Attach Receipt or Invoice"}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setReceipt(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </section>

        {error && (
          <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
            {error}
          </p>
        )}
        <button
          onClick={onSaveClick}
          disabled={value <= 0 || tooLarge || saving}
          className="flex w-full items-center gap-3 rounded-xl bg-primary px-6 py-5 text-on-primary shadow-lg shadow-primary/25 transition hover:bg-primary-container disabled:opacity-50"
        >
          <CircleCheck className="size-6" aria-hidden />
          <span className="flex-1 text-left text-xl font-semibold capitalize">
            {saving && !isEdit ? "Saving…" : isEdit ? "Save changes" : `Save ${kind}`}
          </span>
          <span className="rounded-full bg-primary-container px-4 py-1 font-mono text-lg">{money(value)}</span>
        </button>

        {isEdit && (
          <button
            onClick={() => setConfirm("delete")}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-medium text-secondary hover:bg-secondary-fixed/50 disabled:opacity-50"
          >
            <Trash2 className="size-5" aria-hidden /> Delete transaction
          </button>
        )}

        <ConfirmDialog
          open={confirm === "save"}
          title="Save changes to this transaction?"
          message={
            <>
              It will be updated to <b className="text-on-surface">{note.trim() || categories[category].long}</b>,{" "}
              <b className="font-mono text-on-surface">
                {kind === "income" ? "+" : "-"}
                {money(value)}
              </b>
              .
            </>
          }
          busy={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={() => editId && run(() => update(editId, payload()), "Could not update transaction.")}
        />
        <ConfirmDialog
          open={confirm === "delete"}
          title="Delete this transaction?"
          message="This permanently removes it from your records and updates your balance. This can't be undone."
          danger
          busy={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={() => editId && run(() => remove(editId), "Could not delete transaction.")}
        />
      </main>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  trailing,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label-caps block text-on-surface-variant">{label}</span>
        {children}
      </span>
      {trailing && <span className="pointer-events-none text-on-surface-variant">{trailing}</span>}
    </label>
  );
}
