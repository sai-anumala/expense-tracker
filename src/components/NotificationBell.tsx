"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, CreditCard, HandCoins, Inbox, PieChart, X, type LucideIcon } from "lucide-react";
import { useAppData } from "@/lib/store";
import { isAttention, type Alert, type AlertIcon, type AlertSeverity } from "@/lib/alerts";

export const alertIcons: Record<AlertIcon, LucideIcon> = { card: CreditCard, loan: HandCoins, budget: PieChart, review: Inbox };

export const severityTile: Record<AlertSeverity, string> = {
  urgent: "bg-secondary-fixed text-secondary",
  warning: "bg-tertiary-fixed text-tertiary",
  info: "bg-surface-container-high text-on-surface",
};

/** Current reminders from the signed-in user's data, minus the ones they removed (computed once in the provider). */
export function useAlerts(): Alert[] {
  return useAppData().alerts;
}

/** 🔔 in the header: badge = number of urgent + warning reminders; opens a panel listing them. */
export function NotificationBell() {
  const alerts = useAlerts();
  const { dismissAlerts } = useAppData();
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
          <div className="flex items-center justify-between gap-2 border-b border-surface-container px-4 py-3">
            <p className="font-semibold">
              Reminders
              {count > 0 && <span className="ml-2 text-sm font-normal text-on-surface-variant">{count} need attention</span>}
            </p>
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => dismissAlerts(alerts.map((a) => a.dismissKey))}
                className="-mr-2 shrink-0 rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-surface-container"
              >
                Clear all
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-on-surface-variant">
              <CheckCircle2 className="size-5 text-primary" aria-hidden /> You&apos;re all caught up ✓
            </p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] divide-y divide-surface-container overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.dismissKey} className="flex items-start">
                  <AlertLink alert={a} onNavigate={() => setOpen(false)} />
                  <button
                    type="button"
                    aria-label={`Remove reminder: ${a.title}`}
                    onClick={() => dismissAlerts([a.dismissKey])}
                    className="mt-2 mr-2 grid size-8 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
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
    <Link href={a.href} onClick={onNavigate} className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-1 pl-4 hover:bg-surface-container-low">
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
