// Currency: Indian Rupee with Indian digit grouping (₹1,00,000.00).
export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });

/** Absolute amount, e.g. ₹9,975.00 */
export function money(n: number) {
  return inr.format(Math.abs(n));
}

/** Absolute amount without paise, e.g. ₹9,975 (for compact chart labels). */
export function moneyWhole(n: number) {
  return inrWhole.format(Math.abs(n));
}

/** Amount with a minus only when negative, e.g. ₹4,200.00 or -₹800.00 (for balances). */
export function moneySigned(n: number) {
  return `${n < 0 ? "-" : ""}${money(n)}`;
}

export function signedMoney(n: number) {
  return `${n < 0 ? "-" : "+"}${money(n)}`;
}

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function monthLabel(d = new Date()) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function daysLeftInMonth(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.getDate() - d.getDate() + 1; // includes today
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "Today" / "Yesterday" / "Oct 28" bucket label for a date. */
export function dayBucket(iso: string, now = new Date()) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
