"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

const ACTION_W = 64; // px per action button
const OPEN_EVENT = "ledgerly:row-open"; // only one swipe row open at a time, app-wide

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: "neutral" | "primary" | "danger";
  onClick: () => void;
};

const toneClass: Record<SwipeAction["tone"], string> = {
  neutral: "bg-surface-container-high text-on-surface",
  primary: "bg-primary text-on-primary",
  danger: "bg-secondary text-white",
};

/**
 * Swipe-left row: drag left (touch or mouse) to reveal action buttons, right to hide. A tap or Enter/Space
 * toggles them; Escape closes. Vertical scrolling stays native (touch-action: pan-y).
 * The foreground needs a solid background (pass it in `className`) so it covers the actions.
 */
export function SwipeActions({
  id,
  actions,
  label,
  className = "",
  children,
}: {
  /** Unique id so opening this row closes any other open row. */
  id: string;
  actions: SwipeAction[];
  /** Accessible name of the row, e.g. "Lunch, -₹450". */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const openX = -ACTION_W * actions.length;
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startY: number; baseX: number; axis: "x" | "y" | null; moved: boolean } | null>(
    null,
  );
  const open = x <= openX / 2;

  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setX(0);
    };
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, [id]);

  const snap = (toOpen: boolean) => {
    setX(toOpen ? openX : 0);
    if (toOpen) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: x, axis: null, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (d.axis !== "x") return;
    d.moved = true;
    setX(Math.min(0, Math.max(openX - 24, d.baseX + dx))); // small rubber-band past open
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.axis === "x" && d.moved) snap(x < openX / 2);
    else if (!d.axis) snap(!open); // tap toggles
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: -openX }} aria-hidden={!open}>
        {actions.map(({ label: actionLabel, icon: Icon, tone, onClick }) => (
          <button
            key={actionLabel}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              snap(false);
              onClick();
            }}
            className={`grid flex-1 place-items-center text-[11px] font-medium transition active:brightness-95 ${toneClass[tone]}`}
          >
            <span className="grid place-items-center gap-0.5">
              <Icon className="size-5" aria-hidden />
              {actionLabel}
            </span>
          </button>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${label}. ${open ? "Hide" : "Show"} actions`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            snap(!open);
          } else if (e.key === "Escape") snap(false);
        }}
        className={`relative cursor-pointer touch-pan-y select-none ${dragging ? "" : "transition-transform duration-200 ease-out"} ${className}`}
        style={{ transform: `translateX(${x}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
