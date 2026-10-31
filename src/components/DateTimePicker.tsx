"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const timeLabel = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "Today, 2:45 PM" · "Yesterday, 9:00 AM" · "Fri, 24 Oct, 6:30 PM" */
export function formatWhen(d: Date, now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = sameDay(d, now)
    ? "Today"
    : sameDay(d, yesterday)
      ? "Yesterday"
      : d.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
        });
  return `${day}, ${timeLabel(d)}`;
}

/** Field + compact centered date/time pop-up. Future dates are disabled. */
export function DateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3 text-left transition hover:bg-surface-container"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-caps block text-on-surface-variant">{label}</span>
          <span className="block truncate text-lg">{formatWhen(value)}</span>
        </span>
        <span className="text-sm font-medium text-primary">Change</span>
      </button>
      {open && (
        <PickerSheet
          initial={value}
          onClose={() => setOpen(false)}
          onDone={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function PickerSheet({
  initial,
  onClose,
  onDone,
}: {
  initial: Date;
  onClose: () => void;
  onDone: (d: Date) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const now = new Date();
  const [draft, setDraft] = useState(new Date(initial));
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const today = startOfDay(now);
  const isFuture = (d: Date) => startOfDay(d) > today;
  const canNext = new Date(view.getFullYear(), view.getMonth() + 1, 1) <= today;

  // Calendar grid for the viewed month, Monday-first, padded with blanks.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  const pickDay = (d: Date) =>
    setDraft((prev) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), prev.getHours(), prev.getMinutes()));

  const hour12 = draft.getHours() % 12 || 12;
  const pm = draft.getHours() >= 12;
  const setTime = (h12: number, minute: number, isPm: boolean) =>
    setDraft((prev) => {
      const next = new Date(prev);
      next.setHours((h12 % 12) + (isPm ? 12 : 0), minute, 0, 0);
      return next;
    });

  const quick = (daysBack: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    if (daysBack > 0) d.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    setDraft(d);
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const futureTime = draft > now; // e.g. today but a later hour

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()} // tap backdrop to close
      className="m-auto w-[min(20rem,calc(100%-2rem))] rounded-2xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-on-surface/40"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="truncate text-base font-semibold text-primary">{formatWhen(draft, now)}</p>
          <button aria-label="Close" onClick={onClose} className="-mr-1 rounded-full p-1.5 hover:bg-surface-container">
            <X className="size-4" />
          </button>
        </div>

        {/* Quick picks */}
        <div className="mt-2 flex gap-1.5">
          {[
            { label: "Now", back: 0 },
            { label: "Yesterday", back: 1 },
            { label: "2 days ago", back: 2 },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => quick(q.back)}
              className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium hover:bg-surface-container-high"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div className="mt-3 rounded-xl bg-surface-container-low p-2">
          <div className="mb-1 flex items-center justify-between">
            <button
              aria-label="Previous month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="rounded-full p-1.5 hover:bg-surface-container"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">
              {view.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
            <button
              aria-label="Next month"
              disabled={!canNext}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="rounded-full p-1.5 hover:bg-surface-container disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-[10px] font-semibold text-on-surface-variant">
                {w}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  disabled={isFuture(d)}
                  onClick={() => pickDay(d)}
                  aria-pressed={sameDay(d, draft)}
                  aria-label={d.toDateString()}
                  className={`mx-auto my-px grid size-8 place-items-center rounded-full tabular-nums text-xs transition disabled:opacity-25 ${
                    sameDay(d, draft)
                      ? "bg-primary font-semibold text-on-primary"
                      : sameDay(d, now)
                        ? "font-semibold text-primary ring-1 ring-primary"
                        : "hover:bg-surface-container"
                  }`}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>

        {/* Time */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant">Time</span>
          <div className="flex flex-1 items-center justify-end gap-1">
            <TimeSelect
              label="Hour"
              value={hour12}
              options={Array.from({ length: 12 }, (_, i) => i + 1)}
              onChange={(h) => setTime(h, draft.getMinutes(), pm)}
            />
            <span className="tabular-nums text-base font-semibold">:</span>
            <TimeSelect
              label="Minute"
              value={draft.getMinutes()}
              options={Array.from({ length: 60 }, (_, i) => i)}
              onChange={(m) => setTime(hour12, m, pm)}
            />
            <div className="ml-1 flex rounded-full bg-surface-container p-0.5">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  aria-pressed={(p === "PM") === pm}
                  onClick={() => setTime(hour12, draft.getMinutes(), p === "PM")}
                  className={`rounded-full px-2 py-1 text-xs font-semibold transition ${
                    (p === "PM") === pm ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        {futureTime && <p className="mt-2 text-right text-xs text-secondary">That time hasn&apos;t happened yet.</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-full bg-surface-container py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            disabled={futureTime}
            onClick={() => onDone(draft)}
            className="rounded-full bg-primary py-2 text-sm font-medium text-on-primary disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="appearance-none rounded-lg bg-surface-container px-2 py-1 text-center tabular-nums text-base font-semibold outline-none focus:ring-2 focus:ring-primary"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {String(o).padStart(2, "0")}
        </option>
      ))}
    </select>
  );
}
