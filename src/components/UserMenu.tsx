"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAppData } from "@/lib/store";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Avatar with the signed-in user's initials; opens a menu with account info and Log out. */
export function UserMenu() {
  const { user, logout } = useAppData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-on-primary ring-offset-2 transition hover:ring-2 hover:ring-primary-fixed-dim"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-12 right-0 z-40 w-64 overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl ring-1 ring-surface-container-high"
        >
          <div className="border-b border-surface-container px-4 py-3">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-on-surface-variant">{user.email}</p>
          </div>
          <button
            role="menuitem"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await logout();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-secondary hover:bg-surface-container-low disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden /> {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
