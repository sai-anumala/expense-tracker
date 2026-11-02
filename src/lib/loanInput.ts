import "server-only";
import { MAX_AMOUNT, toPaise } from "./api";
import { LOAN_DIRECTIONS, LOAN_SOURCES, type Loan, type LoanDirection, type LoanSource } from "./loans";

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function parseDate(v: unknown, label: string, allowFuture = false): Result<Date> {
  const d = new Date(String(v));
  if (v === undefined || v === null || v === "" || Number.isNaN(d.getTime())) return { ok: false, error: `Invalid ${label}.` };
  if (!allowFuture && d.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return { ok: false, error: `${label} can't be in the future.` };
  return { ok: true, value: d };
}

function parseMoney(v: unknown, label: string): Result<number> {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `${label} must be more than 0.` };
  if (n > MAX_AMOUNT) return { ok: false, error: `${label} is too large.` };
  return { ok: true, value: toPaise(n) };
}

export type LoanInput = {
  direction: LoanDirection;
  person: string;
  source: LoanSource;
  amount: number;
  totalDue: number;
  date: Date;
  dueDate?: Date;
  monthlyPayment?: number;
  paymentDay?: number;
  account?: string;
  note?: string;
};

/** Validate a create/update body for a loan (payments are handled separately). */
export function parseLoanInput(body: Record<string, unknown>): Result<LoanInput> {
  const direction = body.direction as LoanDirection;
  if (!LOAN_DIRECTIONS.includes(direction)) return { ok: false, error: "Choose whether you lent or borrowed." };

  const person = str(body.person).replace(/\s+/g, " ");
  if (!person) return { ok: false, error: direction === "lent" ? "Who did you lend to?" : "Who did you borrow from?" };
  if (person.length > 60) return { ok: false, error: "Name must be 60 characters or fewer." };

  const source = body.source as LoanSource;
  if (!LOAN_SOURCES.includes(source)) return { ok: false, error: "Choose a source (friend, relative, online app, bank, other)." };

  const amount = parseMoney(body.amount, "Amount");
  if (!amount.ok) return amount;

  let totalDue = amount.value;
  if (body.totalDue !== undefined && body.totalDue !== null && body.totalDue !== "") {
    const t = parseMoney(body.totalDue, "Total to repay");
    if (!t.ok) return t;
    if (t.value < amount.value) return { ok: false, error: "Total to repay can't be less than the amount." };
    totalDue = t.value;
  }

  const date = parseDate(body.date, "Date");
  if (!date.ok) return date;

  let dueDate: Date | undefined;
  if (body.dueDate) {
    const d = parseDate(body.dueDate, "Due date", true);
    if (!d.ok) return d;
    if (d.value < date.value) return { ok: false, error: "Due date can't be before the loan date." };
    dueDate = d.value;
  }

  let monthlyPayment: number | undefined;
  let paymentDay: number | undefined;
  if (body.monthlyPayment !== undefined && body.monthlyPayment !== null && body.monthlyPayment !== "") {
    const m = parseMoney(body.monthlyPayment, "Monthly payment");
    if (!m.ok) return m;
    if (m.value > totalDue) return { ok: false, error: "Monthly payment can't be more than the total to repay." };
    monthlyPayment = m.value;
    const day = Number(body.paymentDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) return { ok: false, error: "Payment day must be between 1 and 28." };
    paymentDay = day;
  }

  const account = str(body.account) || undefined;
  if (account && account.length > 80) return { ok: false, error: "Payment method name is too long." };
  const note = str(body.note) || undefined;
  if (note && note.length > 200) return { ok: false, error: "Note must be 200 characters or fewer." };

  return {
    ok: true,
    value: { direction, person, source, amount: amount.value, totalDue, date: date.value, dueDate, monthlyPayment, paymentDay, account, note },
  };
}

export type PaymentInput = { amount: number; date: Date; account?: string; note?: string };

export function parsePaymentInput(body: Record<string, unknown>): Result<PaymentInput> {
  const amount = parseMoney(body.amount, "Payment amount");
  if (!amount.ok) return amount;
  const date = parseDate(body.date, "Payment date");
  if (!date.ok) return date;
  const account = str(body.account) || undefined;
  if (account && account.length > 80) return { ok: false, error: "Payment method name is too long." };
  const note = str(body.note) || undefined;
  if (note && note.length > 200) return { ok: false, error: "Note must be 200 characters or fewer." };
  return { ok: true, value: { amount: amount.value, date: date.value, account, note } };
}

type LeanPayment = { _id: { toString(): string }; amount: number; date: Date; account?: string | null; note?: string | null };
type LeanLoan = {
  _id: { toString(): string };
  direction: string;
  person: string;
  source: string;
  amount: number;
  totalDue: number;
  date: Date;
  dueDate?: Date | null;
  monthlyPayment?: number | null;
  paymentDay?: number | null;
  account?: string | null;
  note?: string | null;
  payments?: LeanPayment[];
};

export const toLoanDto = (d: LeanLoan): Loan => ({
  id: d._id.toString(),
  direction: d.direction as LoanDirection,
  person: d.person,
  source: d.source as LoanSource,
  amount: d.amount,
  totalDue: d.totalDue,
  date: new Date(d.date).toISOString(),
  dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : undefined,
  monthlyPayment: d.monthlyPayment ?? undefined,
  paymentDay: d.paymentDay ?? undefined,
  account: d.account ?? undefined,
  note: d.note ?? undefined,
  payments: (d.payments ?? [])
    .map((p) => ({
      id: p._id.toString(),
      amount: p.amount,
      date: new Date(p.date).toISOString(),
      account: p.account ?? undefined,
      note: p.note ?? undefined,
    }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
});
