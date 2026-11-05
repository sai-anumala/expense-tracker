"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, CreditCard, HandCoins, Inbox, PieChart, type LucideIcon } from "lucide-react";
import { useAppData } from "@/lib/store";
import { buildAlerts, isAttention, type Alert, type AlertIcon, type AlertSeverity } from "@/lib/alerts";

export const alertIcons: Record<AlertIcon, LucideIcon> = { card: CreditCard, loan: HandCoins, budget: PieChart, review: Inbox };

export const severityTile: Record<AlertSeverity, string> = {
  urgent: "bg-secondary-fixed text-secondary",
  warning: "bg-tertiary-fixed text-tertiary",
  info: "bg-surface-container-high text-on-surface",
};

/** Current reminders from the signed-in user's data (recomputed when the data changes). */
export function useAlerts(): Alert[] {
  const { transactions, transfers, loans, budget, settings, captured, customCategories } = useAppData();
  const pendingReview = captured.length;
  return useMemo(
    () => buildAlerts({ transactions, transfers, loans, budget, settings, pendingReview, customCategories }),
    [transactions, transfers, loans, budget, settings, pendingReview, customCategories],
  );
}

/** 🔔 in the header: badge = number of urgent + warning reminders; opens a panel listing them. */
export function NotificationBell() {
  const alerts = useAlerts();
  const count = alerts.filter(isAttention).length;
  const urgent = alerts.some((a) => a.severity === "urgent");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={count ? `Notifications, ${count} new` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 hover:bg-surface-container"
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className={`absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none font-bold tabular-nums text-white ring-2 ring-surface-container-lowest ${
              urgent ? "bg-secondary" : "bg-tertiary"
            }`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute top-12 -right-14 z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl ring-1 ring-surface-container-high motion-safe:animate-[ledgerly-fade-in_0.15s_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-surface-container px-4 py-3">
            <p className="font-semibold">Reminders</p>
            {count > 0 && <span className="text-sm text-on-surface-variant">{count} need attention</span>}
          </div>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-on-surface-variant">
              <CheckCircle2 className="size-5 text-primary" aria-hidden /> You&apos;re all caught up ✓
            </p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] divide-y divide-surface-container overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id}>
                  <AlertLink alert={a} onNavigate={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AlertLink({ alert: a, onNavigate }: { alert: Alert; onNavigate: () => void }) {
  const Icon = alertIcons[a.icon];
  return (
    <Link href={a.href} onClick={onNavigate} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low">
      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${severityTile[a.severity]}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold break-words ${a.severity === "urgent" ? "text-secondary" : a.severity === "warning" ? "text-tertiary" : ""}`}>
          {a.title}
        </span>
        <span className="block text-sm break-words text-on-surface-variant">{a.body}</span>
      </span>
    </Link>
  );
}
