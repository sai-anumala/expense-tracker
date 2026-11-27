"use client";

import { useEffect, useMemo } from "react";
import { ExternalLink, FileText, ImagePlus, Undo2, X } from "lucide-react";
import type { Receipt } from "@/lib/data";
import { MAX_RECEIPT_MB, RECEIPT_ACCEPT, formatBytes, isImageType } from "@/lib/receipts";

/** Where a saved receipt is served from: the owner-only route, never a public link. */
export const receiptUrl = (transactionId: string) => `/api/transactions/${transactionId}/receipt`;

/** A small preview: the photo itself, or a document icon for a PDF. */
function Thumb({ src, pdf }: { src?: string; pdf: boolean }) {
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-container-lowest text-on-surface-variant">
      {pdf || !src ? (
        <FileText className="size-6" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a private, per-user file; the image optimizer can't fetch it
        <img src={src} alt="" className="size-full object-cover" />
      )}
    </span>
  );
}

/** A saved receipt as shown in the View pop-up: a thumbnail chip that opens the photo or PDF in a new tab. */
export function ReceiptView({ transactionId, receipt }: { transactionId: string; receipt: Receipt }) {
  const url = receiptUrl(transactionId);
  const image = isImageType(receipt.type);
  return (
    <div className="mt-4">
      <p className="label-caps mb-2 text-on-surface-variant">Receipt</p>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 hover:bg-surface-container"
      >
        <Thumb src={image ? url : undefined} pdf={!image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{receipt.name}</span>
          <span className="block text-xs text-on-surface-variant">{formatBytes(receipt.size)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          {image ? "View" : "Open"} <ExternalLink className="size-4" aria-hidden />
        </span>
      </a>
    </div>
  );
}

/**
 * The receipt field on the Add / Edit screen. Shows the saved receipt (Edit), a newly chosen file, or the
 * attach button. Nothing is sent from here: the screen uploads or removes after the transaction itself is saved.
 */
export function ReceiptPicker({
  transactionId,
  existing,
  file,
  removed,
  preparing,
  error,
  disabled,
  onPick,
  onClear,
  onRemoveExisting,
  onUndoRemove,
}: {
  transactionId?: string;
  existing?: Receipt;
  file: File | null;
  removed: boolean;
  preparing: boolean;
  error: string | null;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  onRemoveExisting: () => void;
  onUndoRemove: () => void;
}) {
  const preview = useMemo(() => (file && isImageType(file.type) ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const input = (label: React.ReactNode, className: string) => (
    <label className={`${className} ${disabled || preparing ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
      {label}
      <input
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        disabled={disabled || preparing}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = ""; // choosing the same file again should still count
        }}
      />
    </label>
  );

  const keeping = existing && !removed && !file;

  return (
    <div className="space-y-2">
      {file ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
          <Thumb src={preview ?? undefined} pdf={!preview} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className="block text-xs text-on-surface-variant">
              {formatBytes(file.size)} · {existing ? "replaces the saved receipt" : "will be attached when you save"}
            </span>
          </span>
          {input("Change", "rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface-container")}
          <button
            type="button"
            aria-label="Remove the chosen file"
            onClick={onClear}
            disabled={disabled}
            className="rounded-full p-1.5 hover:bg-surface-container disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : keeping && transactionId ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
          <Thumb src={isImageType(existing.type) ? receiptUrl(transactionId) : undefined} pdf={!isImageType(existing.type)} />
          <span className="min-w-0 flex-1">
            <a href={receiptUrl(transactionId)} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:underline">
              {existing.name}
            </a>
            <span className="block text-xs text-on-surface-variant">{formatBytes(existing.size)}</span>
          </span>
          {input("Replace", "rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface-container")}
          <button
            type="button"
            aria-label="Remove the receipt"
            onClick={onRemoveExisting}
            disabled={disabled}
            className="rounded-full p-1.5 hover:bg-surface-container disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : existing && removed ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
          <span className="min-w-0 flex-1 text-on-surface-variant">The receipt will be removed when you save.</span>
          <button
            type="button"
            onClick={onUndoRemove}
            disabled={disabled}
            className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 font-medium text-primary hover:bg-surface-container"
          >
            <Undo2 className="size-4" aria-hidden /> Undo
          </button>
        </div>
      ) : (
        input(
          <>
            <ImagePlus className="size-5 text-primary" aria-hidden />
            <span>{preparing ? "Preparing…" : "Attach receipt or invoice"}</span>
          </>,
          "flex items-center justify-center gap-3 rounded-lg bg-surface-container-low py-4 text-lg",
        )
      )}
      {!file && !keeping && !(existing && removed) && !preparing && (
        <p className="text-center text-xs text-on-surface-variant">
          Photo or PDF, up to {MAX_RECEIPT_MB} MB. Photos are shrunk to fit.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-2.5 text-sm text-secondary">
          {error}
        </p>
      )}
    </div>
  );
}
