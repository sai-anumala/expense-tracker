"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Every list in the app shows this many items until "View all" is pressed. */
export const LIST_LIMIT = 5;

/** The items to render right now, plus what ViewAllButton needs. */
export function useViewAll<T>(items: T[]) {
  const [expanded, setExpanded] = useState(false);
  return {
    shown: expanded ? items : items.slice(0, LIST_LIMIT),
    total: items.length,
    expanded,
    setExpanded,
  };
}

/** "View all (12)" / "Show less" under a list. Renders nothing when everything already fits. */
export function ViewAllButton({ list }: { list: Pick<ReturnType<typeof useViewAll>, "total" | "expanded" | "setExpanded"> }) {
  if (list.total <= LIST_LIMIT) return null;
  const Icon = list.expanded ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-expanded={list.expanded}
      onClick={() => list.setExpanded(!list.expanded)}
      className="mx-auto mt-2 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface-container-low"
    >
      {list.expanded ? "Show less" : `View all (${list.total})`}
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
