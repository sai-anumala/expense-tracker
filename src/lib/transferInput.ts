import "server-only";
import { MAX_AMOUNT, toPaise } from "./api";
import { isTransferAccount, type TransferAccount } from "./transfers";

export type TransferValue = {
  from: TransferAccount;
  to: TransferAccount;
  amount: number;
  date: Date;
  note?: string;
};

/** Allow a little clock skew between browser and server (same as transactions). */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Validate a create/update body. Returns the clean input or a human-readable error. */
export function parseTransferInput(
  body: Record<string, unknown>,
): { ok: true; value: TransferValue } | { ok: false; error: string } {
  const { from, to } = body;
  if (!isTransferAccount(from)) return { ok: false, error: "Choose the account the money came from." };
  if (!isTransferAccount(to)) return { ok: false, error: "Choose the account the money went to." };
  if (from === to) return { ok: false, error: "From and To must be different accounts." };

  const amount = body.amount === null || body.amount === "" ? NaN : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Amount must be more than zero." };
  if (amount > MAX_AMOUNT) return { ok: false, error: "Amount is too large." };
  const rounded = toPaise(amount);
  if (rounded <= 0) return { ok: false, error: "Amount must be more than zero." };

  const date = new Date(String(body.date));
  if (body.date == null || Number.isNaN(date.getTime())) return { ok: false, error: "Invalid date." };
  if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return { ok: false, error: "Date can't be in the future." };

  if (body.note != null && typeof body.note !== "string") return { ok: false, error: "Note must be text." };
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
  if (note && note.length > 120) return { ok: false, error: "Note must be 120 characters or fewer." };

  return { ok: true, value: { from, to, amount: rounded, date, note } };
}

type Lean = {
  _id: { toString(): string };
  from: string;
  to: string;
  amount: number;
  date: Date;
  note?: string | null;
};

export const toTransferDto = (d: Lean) => ({
  id: d._id.toString(),
  from: d.from,
  to: d.to,
  amount: d.amount,
  date: new Date(d.date).toISOString(),
  note: d.note ?? undefined,
});
