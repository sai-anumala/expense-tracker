"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { isAttention } from "@/lib/alerts";
import { alertIcons, severityTile, useAlerts } from "./NotificationBell";

// Dismissed alert ids for this browser tab only (in memory: survives tab switches, cleared on reload). Not persisted.
const dismissed = new Set<string>();

/** AlertBanner on the Overview page ("/") only; nothing elsewhere. */
export function OverviewAlertBanner() {
  return usePathname() === "/" ? <AlertBanner /> : null;
}

/** Slim banner with the single most important urgent/warning reminder. Rendered by AppHeader on Overview only. */
export function AlertBanner() {
  const alerts = useAlerts();
  const [, rerender] = useState(0);
  const top = alerts.find((a) => isAttention(a) && !dismissed.has(a.id));
  if (!top) return null;
  const Icon = alertIcons[top.icon];
  const urgent = top.severity === "urgent";

  return (
    <div className="px-5 pt-1 pb-2 motion-safe:animate-[ledgerly-fade-in_0.3s_ease-out]">
      <div
        role="status"
        className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${
          urgent ? "bg-secondary-fixed/50 ring-secondary/20" : "bg-tertiary-fixed/50 ring-tertiary/20"
        }`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${severityTile[top.severity]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <Link href={top.href} className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${urgent ? "text-secondary" : "text-tertiary"}`}>{top.title}</span>
          <span className="block truncate text-xs text-on-surface-variant">{top.body}</span>
        </Link>
        <button
          aria-label="Dismiss reminder"
          onClick={() => {
            dismissed.add(top.id);
            rerender((n) => n + 1);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
