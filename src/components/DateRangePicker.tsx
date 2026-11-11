"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { dateRangeLabel, dayFromValue, dayToValue } from "@/lib/transactionFilters";
import { CalendarMonth } from "./DateTimePicker";

/** Field showing the chosen days; opens the calendar. Same look as DateTimePicker. */
export function DateRangeField({ from, to, onOpen }: { from: string; to: string; onOpen: () => void }) {
  const label = dateRangeLabel(from, to);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="col-span-2 flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-left transition hover:bg-surface-container"
    >
      <CalendarDays className="size-5 shrink-0 text-on-surface-variant" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="label-caps block text-on-surface-variant">Dates</span>
        <span className="block truncate text-sm tabular-nums">{label || "Choose dates"}</span>
      </span>
      <span className="text-sm font-medium text-primary">{label ? "Change" : "Choose"}</span>
    </button>
  );
}

/** Compact centered pop-up: tap the first day, then the last; the days between are highlighted. No future days. */
export function DateRangeDialog({
  from,
  to,
  onClose,
  onDone,
}: {
  from: string;
  to: string;
  onClose: () => void;
  onDone: (from: string, to: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(() => dayFromValue(from));
  const [end, setEnd] = useState(() => dayFromValue(to));
  const shown = start ?? end ?? new Date();
  const [view, setView] = useState(new Date(shown.getFullYear(), shown.getMonth(), 1));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function pick(d: Date) {
    if (!start || end) {
      setStart(d);
      setEnd(null);
    } else if (d < start) {
      setEnd(start);
      setStart(d);
    } else {
      setEnd(d);
    }
  }

  const same = (a: Date | null, b: Date) => a !== null && +a === +b;
  const band = (d: Date) => {
    if (!start || !end || +start === +end || d < start || d > end) return "";
    if (+d === +start) return "rounded-l-full bg-primary-fixed/50";
    if (+d === +end) return "rounded-r-full bg-primary-fixed/50";
    return "bg-primary-fixed/50";
  };
  const hint = !start ? "Tap the first day" : !end ? "Now tap the last day" : dateRangeLabel(dayToValue(start), dayToValue(end));

  return (
    <dialog
      ref={ref}
      aria-label="Choose dates"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(20rem,calc(100%-2rem))] rounded-2xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-scrim/40"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p aria-live="polite" className="truncate text-base font-semibold tabular-nums text-primary">
            {hint}
          </p>
          <button aria-label="Close" onClick={onClose} className="-mr-1 rounded-full p-1.5 hover:bg-surface-container">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 rounded-xl bg-surface-container-low p-2">
          <CalendarMonth
            view={view}
            onView={setView}
            onPick={pick}
            isSelected={(d) => same(start, d) || same(end, d)}
            band={band}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-full bg-surface-container py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            disabled={!start}
            onClick={() => start && onDone(dayToValue(start), dayToValue(end ?? start))}
            className="rounded-full bg-primary py-2 text-sm font-medium text-on-primary disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
