import "server-only";
import { CATEGORY_IDS } from "@/models/Transaction";
import { MAX_AMOUNT, toPaise } from "./api";

export type TransactionInput = {
  merchant: string;
  category: (typeof CATEGORY_IDS)[number];
  amount: number;
  date: Date;
  account?: string;
  receiptName?: string;
};

/** Allow a little clock skew between browser and server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Validate a create/update body. Returns the clean input or a human-readable error. */
export function parseTransactionInput(
  body: Record<string, unknown>,
): { ok: true; value: TransactionInput } | { ok: false; error: string } {
  const merchant = typeof body.merchant === "string" ? body.merchant.trim() : "";
  if (!merchant) return { ok: false, error: "Merchant or note is required." };
  if (merchant.length > 120) return { ok: false, error: "Merchant or note must be 120 characters or fewer." };

  const category = body.category as TransactionInput["category"];
  if (!CATEGORY_IDS.includes(category)) return { ok: false, error: "Unknown category." };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) return { ok: false, error: "Amount must be a non-zero number." };
  if (Math.abs(amount) > MAX_AMOUNT) return { ok: false, error: "Amount is too large." };
  if ((category === "income") !== amount > 0)
    return { ok: false, error: "Income must be positive and expenses negative." };

  const date = new Date(String(body.date));
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid date." };
  if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return { ok: false, error: "Date can't be in the future." };

  const account = typeof body.account === "string" && body.account.trim() ? body.account.trim() : undefined;
  if (account && account.length > 80) return { ok: false, error: "Payment method name is too long." };
  const receiptName = typeof body.receiptName === "string" && body.receiptName ? body.receiptName.slice(0, 200) : undefined;

  return { ok: true, value: { merchant, category, amount: toPaise(amount), date, account, receiptName } };
}

type Lean = {
  _id: { toString(): string };
  merchant: string;
  category: string;
  amount: number;
  date: Date;
  account?: string | null;
};

export const toTransactionDto = (d: Lean) => ({
  id: d._id.toString(),
  merchant: d.merchant,
  category: d.category,
  amount: d.amount,
  date: new Date(d.date).toISOString(),
  account: d.account ?? undefined,
});
