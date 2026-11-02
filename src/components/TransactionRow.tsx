"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Eye, Pencil, Trash2, X } from "lucide-react";
import { categories, type Transaction } from "@/lib/data";
import { money, signedMoney, timeOf } from "@/lib/format";
import { errorMessage, useAppData } from "@/lib/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { SwipeActions } from "./SwipeActions";
import { formatWhen } from "./DateTimePicker";
import { IconTile } from "./ui";

/** Transaction row with swipe-left actions (View / Edit / Delete); see SwipeActions. */
export function TransactionRow({ t }: { t: Transaction }) {
  const router = useRouter();
  const { remove } = useAppData();
  const cat = categories[t.category] ?? categories.other;
  const income = t.amount > 0;

  const [viewing, setViewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const doDelete = async () => {
    setBusy(true);
    setDeleteError(null);
    try {
      await remove(t.id);
      setConfirmDelete(false);
    } catch (e) {
      setDeleteError(errorMessage(e, "Could not delete the transaction."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="-mx-5">
      <SwipeActions
        id={`tx-${t.id}`}
        label={`${t.merchant}, ${signedMoney(t.amount)}`}
        className="flex items-center gap-4 bg-surface-container-lowest px-5 py-4"
        actions={[
          { label: "View", icon: Eye, tone: "neutral", onClick: () => setViewing(true) },
          { label: "Edit", icon: Pencil, tone: "primary", onClick: () => router.push(`/add?id=${t.id}`) },
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
        <IconTile icon={cat.icon} tone={income ? "primary" : cat.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{t.merchant}</p>
          <p className="truncate text-sm text-on-surface-variant">
            {cat.long} <span aria-hidden>·</span> {timeOf(t.date)}
            {t.account && (
              <>
                {" "}
                <span aria-hidden>·</span> {t.account}
              </>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 text-[17px] font-semibold tabular-nums ${income ? "text-primary" : "text-secondary"}`}
        >
          {signedMoney(t.amount)}
        </span>
        <ChevronLeft className="-ml-2 size-4 shrink-0 text-outline-variant" aria-hidden />
      </SwipeActions>

      {viewing && <TransactionDetails t={t} onClose={() => setViewing(false)} onEdit={() => router.push(`/add?id=${t.id}`)} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this transaction?"
        message={
          <>
            <b className="text-on-surface">{t.merchant}</b>,{" "}
            <b className="tabular-nums text-on-surface">{signedMoney(t.amount)}</b> will be permanently removed and your
            balance updated.
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

/** Read-only details pop-up for one transaction. */
function TransactionDetails({ t, onClose, onEdit }: { t: Transaction; onClose: () => void; onEdit: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cat = categories[t.category] ?? categories.other;
  const income = t.amount > 0;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const rows: [string, string][] = [
    ["Type", income ? "Income" : "Expense"],
    ["Category", cat.long],
    ["Date & time", formatWhen(new Date(t.date))],
    [income ? "Received via" : "Paid with", t.account || "—"],
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
            <IconTile icon={cat.icon} tone={income ? "primary" : cat.tone} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{t.merchant}</p>
              <p className="text-sm text-on-surface-variant">{cat.long}</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="-mr-1 rounded-full p-1.5 hover:bg-surface-container">
            <X className="size-5" />
          </button>
        </div>

        <p className={`mt-4 text-3xl font-bold tracking-tight tabular-nums ${income ? "text-primary" : "text-secondary"}`}>
          {income ? "+" : "-"}
          {money(t.amount)}
        </p>

        <dl className="mt-4 divide-y divide-surface-container rounded-xl bg-surface-container-low px-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <dt className="text-on-surface-variant">{k}</dt>
              <dd className="truncate text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>

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

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
