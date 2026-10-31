"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/format";

const MAX = 10_000_000_000; // keep in sync with MAX_AMOUNT in src/lib/api.ts

/** Inline "₹ [amount] Save ✕" form used for limits and balances. */
export function AmountForm({
  label,
  initial,
  allowZero = true,
  onSave,
  onCancel,
}: {
  label: string;
  initial?: number;
  allowZero?: boolean;
  /** Should throw (or reject) on failure; the form shows the message. */
  onSave: (v: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [val, setVal] = useState(initial !== undefined ? String(initial) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number.parseFloat(val);
  const invalid = !Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > MAX;
  const hint = val && n > MAX ? "That amount is too large." : null;

  return (
    <div className="mt-4">
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (invalid || busy) return;
          setBusy(true);
          setError(null);
          try {
            await onSave(Math.round(n * 100) / 100);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 tabular-nums">
          <span className="text-outline">{CURRENCY_SYMBOL}</span>
          <input
            aria-label={label}
            aria-invalid={Boolean(hint || error)}
            autoFocus
            inputMode="decimal"
            value={val}
            placeholder="0.00"
            onChange={(e) => setVal(sanitizeAmount(e.target.value))}
            className="w-full bg-transparent outline-none"
          />
        </label>
        <button
          disabled={busy || invalid}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button
            type="button"
            aria-label="Cancel"
            disabled={busy}
            onClick={onCancel}
            className="rounded-full p-2 hover:bg-surface-container disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        )}
      </form>
      {(hint || error) && (
        <p role="alert" className="mt-2 text-sm text-secondary">
          {hint ?? error}
        </p>
      )}
    </div>
  );
}

/** Keep digits and a single decimal point, max 2 decimal places. */
export function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}
