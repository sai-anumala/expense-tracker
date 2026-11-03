import "server-only";
import { MAX_AMOUNT, toPaise } from "./api";
import type { CardSettings } from "./creditCard";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isBlank = (v: unknown) => v === undefined || v === null || v === "";

/**
 * PUT /api/settings body: `{ openingBalance: number ≥ 0 | null, cardDueAtAnchor?: number ≥ 0 }`.
 * Clearing the balance (null) also clears the unpaid card amount. Re-entering a balance without
 * `cardDueAtAnchor` sets it to 0 (nothing unpaid on the card).
 */
export function parseBalanceInput(
  body: Record<string, unknown>,
): Result<{ openingBalance: number | null; cardDueAtAnchor: number | null }> {
  if (!("openingBalance" in body)) return { ok: false, error: "openingBalance is required." };
  const raw = body.openingBalance;
  if (raw === null) return { ok: true, value: { openingBalance: null, cardDueAtAnchor: null } };

  const openingBalance = raw === "" || typeof raw === "boolean" ? NaN : Number(raw);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) return { ok: false, error: "Opening balance must be 0 or more." };
  if (openingBalance > MAX_AMOUNT) return { ok: false, error: "Opening balance is too large." };

  let cardDueAtAnchor = 0;
  if (!isBlank(body.cardDueAtAnchor)) {
    const n = typeof body.cardDueAtAnchor === "boolean" ? NaN : Number(body.cardDueAtAnchor);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Unpaid credit card amount must be 0 or more." };
    if (n > MAX_AMOUNT) return { ok: false, error: "Unpaid credit card amount is too large." };
    cardDueAtAnchor = toPaise(n);
  }
  return { ok: true, value: { openingBalance: toPaise(openingBalance), cardDueAtAnchor } };
}

function parseDay(v: unknown, what: string): number | string {
  const n = isBlank(v) || typeof v === "boolean" ? NaN : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 28) return `${what} must be a whole day between 1 and 28.`;
  return n;
}

/**
 * PUT /api/settings/card body: `{ statementDay, dueDay, limit? }` to set up / edit the card,
 * or `{ card: null }` to remove it. Never touches the balance anchor.
 */
export function parseCardInput(body: Record<string, unknown>): Result<CardSettings | null> {
  if ("card" in body) {
    if (body.card === null) return { ok: true, value: null };
    return { ok: false, error: "Send { card: null } to remove the card, or statementDay and dueDay to set it up." };
  }
  const statementDay = parseDay(body.statementDay, "Statement day");
  if (typeof statementDay === "string") return { ok: false, error: statementDay };
  const dueDay = parseDay(body.dueDay, "Due day");
  if (typeof dueDay === "string") return { ok: false, error: dueDay };
  if (dueDay === statementDay) return { ok: false, error: "Due day must be different from the statement day." };

  const value: CardSettings = { statementDay, dueDay };
  if (!isBlank(body.limit)) {
    const limit = typeof body.limit === "boolean" ? NaN : Number(body.limit);
    if (!Number.isFinite(limit) || limit <= 0) return { ok: false, error: "Credit limit must be more than zero (or leave it empty)." };
    if (limit > MAX_AMOUNT) return { ok: false, error: "Credit limit is too large." };
    value.limit = toPaise(limit);
  }
  return { ok: true, value };
}

export type SettingsLean = {
  openingBalance?: number | null;
  balanceAsOf?: Date | null;
  cardDueAtAnchor?: number | null;
  card?: { statementDay: number; dueDay: number; limit?: number | null } | null;
  updatedAt?: Date;
};

/** Settings API payload: `{ openingBalance, balanceAsOf, cardDueAtAnchor, card }` (null defaults). */
export function toSettingsDto(d: SettingsLean | null) {
  const openingBalance = d?.openingBalance ?? null;
  // Older docs have no balanceAsOf: the balance was entered when the doc was last saved.
  const asOf = openingBalance === null ? null : (d?.balanceAsOf ?? d?.updatedAt ?? null);
  const card: CardSettings | null = d?.card
    ? { statementDay: d.card.statementDay, dueDay: d.card.dueDay, ...(d.card.limit ? { limit: d.card.limit } : {}) }
    : null;
  return {
    openingBalance,
    balanceAsOf: asOf ? new Date(asOf).toISOString() : null,
    // Docs saved before the card model have no value → null (the Overview asks once for the unpaid amount).
    cardDueAtAnchor: openingBalance === null ? null : (d?.cardDueAtAnchor ?? null),
    card,
  };
}
