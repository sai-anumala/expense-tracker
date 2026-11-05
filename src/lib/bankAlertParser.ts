// Reads a bank alert email into a suggested transaction for the review list. Pure, no DB.
// See AGENTS.md §11 "Gmail auto-capture". Conservative on purpose: anything that isn't clearly a completed transaction
// is dropped and never stored.

export const CAPTURED_KINDS = ["expense", "income", "cardBill", "atmWithdrawal"] as const;
export type CapturedKind = (typeof CAPTURED_KINDS)[number];

export type AlertIgnoreReason = "otp" | "failed" | "request" | "upcoming" | "reminder" | "promotion" | "not-a-transaction";

export type ParsedAlert =
  | {
      captured: true;
      amount: number;
      kind: CapturedKind;
      /** Payment method label from lib/data.ts; undefined when the alert doesn't say (e.g. just "card"). */
      account?: string;
      merchant?: string;
      /** The alert with account/card/reference numbers and balances hidden. This is what gets stored. */
      maskedText: string;
    }
  | { captured: false; reason: AlertIgnoreReason };

const MAX_AMOUNT = 10_000_000_000; // keep in sync with src/lib/api.ts
/** The transaction comes first in an alert; footers hold disclaimers and adverts that would confuse the rules. */
const MAX_PARSED_CHARS = 800;

/** One line of text to parse: subject, then the start of the body, with whitespace collapsed. */
export function alertText(subject: string, body: string): string {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return [clean(subject), clean(body)].filter(Boolean).join(". ").slice(0, MAX_PARSED_CHARS);
}

const CURRENCY = String.raw`(?:₹|(?<![a-z])(?:rs|inr)\.?)\s*`;
const NUMBER = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const AMOUNT_RE = new RegExp(`${CURRENCY}(${NUMBER})`, "i");
const BARE_AMOUNT_RE = new RegExp(String.raw`\b(?:debited|credited)\s+(?:by|for|with)\s+(${NUMBER})`, "i");

const BALANCE_RE = new RegExp(String.raw`\b(avl|avail|available|bal|balance|lmt|limit|lim)\b[\s:.\-=]*(?:is\s+|of\s+)?${CURRENCY}${NUMBER}`, "gi");
// First group = numbers to keep (amounts, dates, years); anything else with 3+ digits is hidden.
const MASK_RE = new RegExp(
  String.raw`(${CURRENCY}${NUMBER}|\b(?:debited|credited)\s+(?:by|for|with)\s+${NUMBER}|\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b|\b(?:19|20)\d\d\b)|[xX*]*\d{3,}`,
  "gi",
);

/** Hide balances and every long number (account, card, reference, phone), keeping amounts and dates readable. */
export function maskAlert(text: string): string {
  return text
    .replace(BALANCE_RE, (_m, label: string) => `${label} XXXX`)
    .replace(MASK_RE, (m, keep?: string) => (keep ? m : "XXXX"));
}

// Banks often add "never share your OTP" to genuine alerts, so the warning itself must not count as an OTP message.
const WARNING_RE = /\b(?:never|do not|don'?t|not to|will not|won'?t)\s+(?:\w+\s+){0,3}?(?:share|asks?|disclose|reveal)\b[^.;]*/gi;
const OTP_RE = /\b(?:otp|one[- ]?time[- ]?password|verification code|security code|secret code|cvv)\b/i;
const FAILED_RE = /\b(?:declined|failed|unsuccessful|rejected|could not be processed|insufficient (?:funds|balance))\b/i;
const REQUEST_RE = /\b(?:collect request|payment request|has requested|requested (?:money|payment|rs|inr))\b/i;
const UPCOMING_RE =
  /\b(?:will be|to be|shall be|can be|could be|may be)\s+(?:debited|charged|deducted|credited)\b|\bmandate\b[^.;]*\b(?:registered|created|set ?up|approved)\b|\bupcoming\b/i;
const CARD_RE = /credit\s?card|\bcc\b|\bcard\b/i;
// Allows dots between the words: amounts like "Rs.5,000" sit in the middle.
const BILL_PAID_RE = /\bpayment\b.{0,80}?\b(?:received|credited|successful|thank)|\b(?:thank|received)\b.{0,80}?\bpayment\b|\btowards\b[^.]{0,40}\bcard\b/i;
const REMINDER_RE = /\b(?:statement (?:is|for|generated)|total (?:amount )?due|min(?:imum)?\.? (?:amount )?due|(?:payment|bill)(?: is)? due|due (?:date|on|by)|overdue)\b/i;
const PROMO_RE = /\b(?:offers?|pre-?approved|congratulations|apply now|eligible|limited period|discount|win|voucher)\b/i;
const SPENT_RE = /\b(?:debited|spent)\b/i;
const DEBIT_RE = /\b(?:debited|spent|paid|sent|withdrawn|purchase|charged|deducted|transaction of|txn of|using your)\b/i;
const CREDIT_RE = /\b(?:credited|received|refund(?:ed)?|deposited|reversed|reversal)\b/i;
const ATM_RE = /\b(?:atm|cash withdrawal|withdrawn)\b/i;

const STOP = String.raw`(?=\s+(?:on|ref\w*|upi|via|using|avl|bal|not|if|dated?)\b|[.;,\n]|$)`;
const NAME = String.raw`([^.;,\n]{2,40}?)`;
const DEBIT_MERCHANT = [
  /\bvpa\s+\S+\s+\(([^()\n]{2,60})\)/i, // "towards VPA abc@bank (MERCHANT NAME)"
  new RegExp(String.raw`\bat\s+${NAME}${STOP}`, "i"),
  new RegExp(String.raw`\bto\s+(?:vpa\s+)?${NAME}${STOP}`, "i"),
  /;\s*([^.;,\n]{2,40}?)\s+credited\b/i,
];
const CREDIT_MERCHANT = [
  /\bvpa\s+\S+\s+\(([^()\n]{2,60})\)/i,
  new RegExp(String.raw`\bfrom\s+(?:vpa\s+)?${NAME}${STOP}`, "i"),
];
const NOT_A_NAME = /^(?:your|the|you|a\/?c|ac\b|acct|account|card|credit card|debit card|bank\b|block|report|dispute|stop|call|sms|us\b|customer|support|xxxx)/i;

function findMerchant(text: string, debit: boolean): string | undefined {
  for (const re of debit ? DEBIT_MERCHANT : CREDIT_MERCHANT) {
    const name = re.exec(text)?.[1]?.replace(/\s+/g, " ").trim();
    if (name && !NOT_A_NAME.test(name)) return name.slice(0, 120);
  }
  return undefined;
}

function findAccount(text: string): string | undefined {
  if (/credit\s?card|\bcc\b/i.test(text)) return "Credit Card";
  if (/debit\s?card|atm card/i.test(text)) return "Debit Card";
  if (/\bupi\b|\bvpa\b|@[a-z]{2,}/i.test(text)) return "UPI";
  if (/\bcard\b/i.test(text)) return undefined; // credit or debit? The user must say: it changes the balance.
  if (/a\/c|\bacct\b|\baccount\b|\bneft\b|\bimps\b|\brtgs\b/i.test(text)) return "Bank Transfer";
  return undefined;
}

function findAmount(text: string): number | null {
  const raw = AMOUNT_RE.exec(text)?.[1] ?? BARE_AMOUNT_RE.exec(text)?.[1];
  if (!raw) return null;
  const n = Math.round(Number(raw.replace(/,/g, "")) * 100) / 100;
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? n : null;
}

const firstMatch = (re: RegExp, text: string) => {
  const i = text.search(re);
  return i < 0 ? Infinity : i;
};

/** Suggest a transaction from an alert (see alertText), or say why it was ignored. */
export function parseBankAlert(text: string): ParsedAlert {
  const ignore = (reason: AlertIgnoreReason): ParsedAlert => ({ captured: false, reason });

  if (OTP_RE.test(text.replace(WARNING_RE, " "))) return ignore("otp");
  if (FAILED_RE.test(text)) return ignore("failed");
  if (REQUEST_RE.test(text)) return ignore("request");
  if (UPCOMING_RE.test(text)) return ignore("upcoming");

  const maskedText = maskAlert(text);
  const amount = findAmount(maskedText);
  const billPaid = CARD_RE.test(text) && BILL_PAID_RE.test(text);

  if (!billPaid && !SPENT_RE.test(text)) {
    if (REMINDER_RE.test(text)) return ignore("reminder");
    if (PROMO_RE.test(text)) return ignore("promotion");
  }
  if (amount === null) return ignore("not-a-transaction");
  if (billPaid) return { captured: true, amount, kind: "cardBill", account: "Credit Card", maskedText };

  const debitAt = firstMatch(DEBIT_RE, text);
  const creditAt = firstMatch(CREDIT_RE, text);
  if (debitAt === Infinity && creditAt === Infinity) return ignore("not-a-transaction");
  // "A/c debited ...; RAVI credited": the first verb describes the user's own money.
  const debit = debitAt < creditAt;

  if (debit && ATM_RE.test(text)) return { captured: true, amount, kind: "atmWithdrawal", maskedText };
  return {
    captured: true,
    amount,
    kind: debit ? "expense" : "income",
    account: findAccount(maskedText),
    merchant: findMerchant(maskedText, debit),
    maskedText,
  };
}
