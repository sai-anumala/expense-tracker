"use client";

import { useState } from "react";
import { CreditCard, X } from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { sanitizeAmount } from "./AmountForm";

const MAX = 10_000_000_000; // keep in sync with MAX_AMOUNT in src/lib/api.ts

/**
 * Balance entry (Overview): Total available balance (Bank + UPI + Cash, required) and the optional unpaid
 * credit card amount right now (billed + unbilled; empty = 0). Same look as AmountForm; shows its own errors.
 */
export function BalanceForm({
  initialBalance,
  initialCardDue,
  onSave,
  onCancel,
}: {
  initialBalance?: number;
  initialCardDue?: number;
  /** Should throw (or reject) on failure; the form shows the message. */
  onSave: (v: { openingBalance: number; cardDueAtAnchor: number }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [bal, setBal] = useState(initialBalance !== undefined ? String(initialBalance) : "");
  const [due, setDue] = useState(initialCardDue ? String(initialCardDue) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const b = Number.parseFloat(bal);
  const d = due ? Number.parseFloat(due) : 0;
  const invalid = !Number.isFinite(b) || b < 0 || b > MAX || !Number.isFinite(d) || d < 0 || d > MAX;
  const hint = (bal && b > MAX) || d > MAX ? "That amount is too large." : null;

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (invalid || busy) return;
        setBusy(true);
        setError(null);
        try {
          await onSave({ openingBalance: Math.round(b * 100) / 100, cardDueAtAnchor: Math.round(d * 100) / 100 });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <span className="label-caps mb-1 block px-1 text-on-surface-variant">Bank + UPI + cash</span>
        <label className="flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 tabular-nums">
          <span className="text-outline">{CURRENCY_SYMBOL}</span>
          <input
            aria-label="Total available balance"
            aria-invalid={Boolean(hint || error)}
            autoFocus
            inputMode="decimal"
            value={bal}
            placeholder="0.00"
            onChange={(e) => setBal(sanitizeAmount(e.target.value))}
            className="w-full bg-transparent outline-none"
          />
        </label>
      </div>
      <div>
        <span className="mb-1 flex items-center gap-1.5 px-1 text-xs text-on-surface-variant">
          <CreditCard className="size-3.5 shrink-0" aria-hidden />
          Unpaid credit card amount right now (billed + unbilled), optional
        </span>
        <label className="flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 tabular-nums">
          <span className="text-outline">{CURRENCY_SYMBOL}</span>
          <input
            aria-label="Unpaid credit card amount right now"
            inputMode="decimal"
            value={due}
            placeholder="0.00"
            onChange={(e) => setDue(sanitizeAmount(e.target.value))}
            className="w-full bg-transparent outline-none"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            <X className="size-4" aria-hidden /> Cancel
          </button>
        )}
        <button
          disabled={busy || invalid}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {(hint || error) && (
        <p role="alert" className="text-sm text-secondary">
          {hint ?? error}
        </p>
      )}
    </form>
  );
}
