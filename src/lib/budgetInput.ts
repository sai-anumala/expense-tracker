import "server-only";
import { isMonthKey, monthIndex } from "./budgetHistory";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * PUT /api/budget `month` ("YYYY-MM", the user's local month): which month this save belongs to.
 * Left out = no history entry is written. The client sends it because the server runs in UTC and
 * would get the month wrong for a few hours around midnight on the 1st. Only the server's current
 * month, the one before and the one after are accepted, which covers every time zone.
 */
export function parseBudgetMonth(value: unknown, now = new Date()): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (!isMonthKey(value)) return { ok: false, error: "Month must look like 2026-11." };
  const here = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (Math.abs(monthIndex(value) - here) > 1) return { ok: false, error: "Month must be the current month." };
  return { ok: true, value };
}
