"use client";

import { useEffect, useRef } from "react";

/** Modal "Are you sure?" dialog with Yes / Cancel. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault(); // Esc → our handler, so state stays in sync
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-xl bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-on-surface/40"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <div className="mt-2 text-sm text-on-surface-variant">{message}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-full px-5 py-2.5 font-medium hover:bg-surface-container disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          autoFocus
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-full px-5 py-2.5 font-medium disabled:opacity-50 ${
            danger ? "bg-secondary text-white" : "bg-primary text-on-primary"
          }`}
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
