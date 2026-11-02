// Builds CSV rows for loan exports. Pure functions (no DOM) so they can be tested directly.
import { csvAmount, csvDate, csvDateTime } from "./csv";
import { loanSourceLabels, loanStatus, type Loan } from "./loans";

type Row = (string | number)[];

const statusLabel = (s: ReturnType<typeof loanStatus>) => (s.settled ? "Settled" : s.overdue ? "Overdue" : "Open");

/** One row per loan: everything lent and borrowed, newest first. */
export function loansSummaryRows(loans: Loan[], now = new Date()): Row[] {
  const header = [
    "Person",
    "Type",
    "Source",
    "Date",
    "Amount (INR)",
    "Total to repay (INR)",
    "Repaid (INR)",
    "Outstanding (INR)",
    "Status",
    "Repay by",
    "Monthly payment (INR)",
    "Payment day",
    "Next payment",
    "Repayments",
    "Last repayment",
    "Payment method",
    "Note",
  ];
  const rows = [...loans]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((l) => {
      const s = loanStatus(l, now);
      const last = l.payments.reduce<string | null>((m, p) => (!m || p.date > m ? p.date : m), null);
      return [
        l.person,
        l.direction === "lent" ? "Lent (they owe you)" : "Borrowed (you owe)",
        loanSourceLabels[l.source],
        csvDateTime(l.date),
        csvAmount(l.amount),
        csvAmount(l.totalDue),
        csvAmount(s.paid),
        csvAmount(s.outstanding),
        statusLabel(s),
        csvDate(l.dueDate),
        csvAmount(l.monthlyPayment),
        l.paymentDay ?? "",
        s.nextPayment ? csvDate(s.nextPayment) : "",
        l.payments.length,
        csvDateTime(last),
        l.account ?? "",
        l.note ?? "",
      ];
    });
  return [header, ...rows];
}

const samePerson = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Statement with one person (all loans with the same name, case-insensitive), oldest first:
 * each loan start and each repayment, with the loan's outstanding amount and the running net position
 * (positive = they owe you, negative = you owe them).
 */
export function personStatementRows(loans: Loan[], person: string): Row[] {
  const mine = loans.filter((l) => samePerson(l.person, person));
  type Event = { date: string; loan: Loan; kind: "start" | "payment"; amount: number; account?: string; note?: string };
  const events: Event[] = [];
  for (const l of mine) {
    events.push({ date: l.date, loan: l, kind: "start", amount: l.amount, account: l.account, note: l.note });
    for (const p of l.payments) events.push({ date: p.date, loan: l, kind: "payment", amount: p.amount, account: p.account, note: p.note });
  }
  // Oldest first; a loan's start always comes before its own repayments at the same timestamp.
  events.sort((a, b) => +new Date(a.date) - +new Date(b.date) || (a.kind === "start" ? -1 : 1));

  const outstanding = new Map<string, number>();
  const round = (n: number) => Math.round(n * 100) / 100;
  const netPosition = () =>
    round(mine.reduce((sum, l) => sum + (outstanding.get(l.id) ?? 0) * (l.direction === "lent" ? 1 : -1), 0));

  const header = [
    "Date",
    "Loan",
    "Event",
    "Amount (INR)",
    "Cash effect for you (INR)",
    "Outstanding on this loan (INR)",
    "Net position (INR, + they owe you / − you owe them)",
    "Payment method",
    "Note",
  ];

  const rows: Row[] = events.map((e) => {
    const l = e.loan;
    const lent = l.direction === "lent";
    const loanLabel = `${lent ? "Lent" : "Borrowed"} ${csvDate(l.date)} · ${csvAmount(l.amount)}${
      l.totalDue !== l.amount ? ` (repay ${csvAmount(l.totalDue)})` : ""
    }`;
    let event: string;
    let cash: number;
    if (e.kind === "start") {
      outstanding.set(l.id, l.totalDue);
      event = lent ? "You lent" : "You borrowed";
      cash = lent ? -e.amount : e.amount;
    } else {
      outstanding.set(l.id, Math.max(0, round((outstanding.get(l.id) ?? l.totalDue) - e.amount)));
      event = lent ? "Repayment received" : "Repayment made";
      cash = lent ? e.amount : -e.amount;
    }
    return [
      csvDateTime(e.date),
      loanLabel,
      event,
      csvAmount(e.amount),
      csvAmount(cash),
      csvAmount(outstanding.get(l.id)),
      csvAmount(netPosition()),
      e.account ?? "",
      e.note ?? "",
    ];
  });

  const finalNet = netPosition();
  const summary: Row[] = [
    [],
    [
      "Summary",
      `${mine.length} loan${mine.length === 1 ? "" : "s"} with ${mine[0]?.person ?? person}`,
      finalNet > 0 ? "They owe you" : finalNet < 0 ? "You owe them" : "All settled",
      csvAmount(Math.abs(finalNet)),
    ],
  ];
  return [header, ...rows, ...summary];
}
