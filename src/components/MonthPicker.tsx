"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useAppData } from "@/lib/store";
import { monthKey, monthKeyLabel, monthSummaries } from "@/lib/budgetHistory";
import { money } from "@/lib/format";

/**
 * The month pill. Tap it for the months that have data (the current one and every earlier month with a
 * transaction or a saved budget). The choice is shared by Overview and Budgets; past months are read-only.
 */
export function MonthPicker() {
  const { transactions, budget, viewMonth, setViewMonth } = useAppData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const current = monthKey(new Date());
  const months = useMemo(() => monthSummaries(transactions, budget, current), [transactions, budget, current]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-surface-container px-4 py-2 font-semibold"
      >
        <CalendarDays className="size-4 text-primary" aria-hidden />
        {monthKeyLabel(viewMonth)}
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-label="Choose a month"
        onCancel={(e) => {
          e.preventDefault(); // Esc → our handler, so state stays in sync
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false); // backdrop
        }}
        className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-xl bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-scrim/40"
      >
        <div className="p-5 pb-2">
          <h2 className="text-lg font-semibold">Choose a month</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Past months are read-only.</p>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto px-2 pb-2">
          {months.map(({ month, spent }) => {
            const selected = month === viewMonth;
            return (
              <li key={month}>
                <button
                  onClick={() => {
                    setViewMonth(month);
                    setOpen(false);
                  }}
                  aria-current={selected ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${
                    selected ? "bg-primary-fixed/50 text-primary" : "hover:bg-surface-container"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{monthKeyLabel(month)}</span>
                    <span className="block text-xs text-on-surface-variant">
                      {month === current ? "This month · " : ""}
                      {spent > 0 ? `${money(spent)} spent` : "Nothing spent"}
                    </span>
                  </span>
                  {selected && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end border-t border-surface-container p-3">
          <button onClick={() => setOpen(false)} className="rounded-full px-5 py-2 font-medium hover:bg-surface-container">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
