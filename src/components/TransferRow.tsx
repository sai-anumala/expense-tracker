"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronLeft, Eye, Pencil, Trash2, X } from "lucide-react";
import { money, timeOf } from "@/lib/format";
import { errorMessage, useAppData } from "@/lib/store";
import { isCardAdvance, isCardBill, transferAccountLabels, transferHint, transferRoute, type Transfer } from "@/lib/transfers";
import { ConfirmDialog } from "./ConfirmDialog";
import { SwipeActions } from "./SwipeActions";
import { formatWhen } from "./DateTimePicker";

/** Neutral-blue ⇄ tile: transfers are neither income (green) nor spending (red). */
export function TransferIcon({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`${size === "md" ? "size-12" : "size-10"} grid shrink-0 place-items-center rounded-lg bg-[#e3eefc] text-[#2a78d6]`}
    >
      <ArrowLeftRight className="size-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

const typeOf = (t: Transfer) => (isCardBill(t) ? "Card bill payment" : isCardAdvance(t) ? "Card cash withdrawal" : "Transfer");
const titleOf = (t: Transfer) => t.note || typeOf(t);

/** Transfer row with swipe-left actions (View / Edit / Delete); mirrors TransactionRow. */
export function TransferRow({ t }: { t: Transfer }) {
  const router = useRouter();
  const { removeTransfer } = useAppData();
  const [viewing, setViewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const edit = () => router.push(`/transfer?id=${t.id}`);

  const doDelete = async () => {
    setBusy(true);
    setDeleteError(null);
    try {
      await removeTransfer(t.id);
      setConfirmDelete(false);
    } catch (e) {
      setDeleteError(errorMessage(e, "Could not delete the transfer."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="-mx-5">
      <SwipeActions
        id={`tr-${t.id}`}
        label={`Transfer ${transferRoute(t)}, ${money(t.amount)}`}
        className="flex items-center gap-4 bg-surface-container-lowest px-5 py-4"
        actions={[
          { label: "View", icon: Eye, tone: "neutral", onClick: () => setViewing(true) },
          { label: "Edit", icon: Pencil, tone: "primary", onClick: edit },
          {
            label: "Delete",
            icon: Trash2,
            tone: "danger",
            onClick: () => {
              setDeleteError(null);
              setConfirmDelete(true);
            },
          },
        ]}
      >
        <TransferIcon />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{titleOf(t)}</p>
          <p className="truncate text-sm text-on-surface-variant">
            {transferRoute(t)} <span aria-hidden>·</span> {timeOf(t.date)}
          </p>
        </div>
        <span className="shrink-0 text-[17px] font-semibold tabular-nums text-on-surface">{money(t.amount)}</span>
        <ChevronLeft className="-ml-2 size-4 shrink-0 text-outline-variant" aria-hidden />
      </SwipeActions>

      {viewing && <TransferDetails t={t} onClose={() => setViewing(false)} onEdit={edit} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this transfer?"
        message={
          <>
            <b className="text-on-surface">{transferRoute(t)}</b>,{" "}
            <b className="tabular-nums text-on-surface">{money(t.amount)}</b> will be permanently removed. Your balance
            won&apos;t change (transfers never affect it).
            {deleteError && (
              <span role="alert" className="mt-2 block text-secondary">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Yes, delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </li>
  );
}

/** Read-only details pop-up for one transfer. */
function TransferDetails({ t, onClose, onEdit }: { t: Transfer; onClose: () => void; onEdit: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const rows: [string, string][] = [
    ["Type", typeOf(t)],
    ["From", transferAccountLabels[t.from]],
    ["To", transferAccountLabels[t.to]],
    ["Date & time", formatWhen(new Date(t.date))],
    ["Note", t.note || "—"],
  ];

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-2xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-on-surface/40"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TransferIcon />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{titleOf(t)}</p>
              <p className="text-sm text-on-surface-variant">{transferRoute(t)}</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="-mr-1 rounded-full p-1.5 hover:bg-surface-container">
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-on-surface">{money(t.amount)}</p>

        <dl className="mt-4 divide-y divide-surface-container rounded-xl bg-surface-container-low px-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <dt className="text-on-surface-variant">{k}</dt>
              <dd className="truncate text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-on-surface-variant">
          {transferHint(t)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-full bg-surface-container py-2.5 font-medium">
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 font-medium text-on-primary"
          >
            <Pencil className="size-4" aria-hidden /> Edit
          </button>
        </div>
      </div>
    </dialog>
  );
}
