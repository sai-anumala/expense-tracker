// Builds CSV rows for loan exports. Kept deliberately simple (plain columns, date only).
// Pure functions (no DOM) so they can be tested directly.
import { csvAmount, csvDate } from "./csv";
import { loanStatus, type Loan } from "./loans";

type Row = (string | number)[];

/** All loans, one row each (newest first), then two total lines. */
export function loansSummaryRows(loans: Loan[], now = new Date()): Row[] {
  let toGet = 0;
  let toPay = 0;
  const rows: Row[] = [...loans]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((l) => {
      const s = loanStatus(l, now);
      if (!s.settled) {
        if (l.direction === "lent") toGet += s.outstanding;
        else toPay += s.outstanding;
      }
      return [
        l.person,
        l.direction === "lent" ? "Lent" : "Borrowed",
        csvDate(l.date),
        csvAmount(l.totalDue),
        csvAmount(s.paid),
        csvAmount(s.outstanding),
        s.settled ? "Settled" : s.overdue ? "Overdue" : "Open",
      ];
    });
  return [
    ["Person", "Type", "Date", "Total (INR)", "Repaid (INR)", "Remaining (INR)", "Status"],
    ...rows,
    [],
    ["You will get", "", "", "", "", csvAmount(toGet)],
    ["You owe", "", "", "", "", csvAmount(toPay)],
  ];
}

const samePerson = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Passbook-style statement with one person (every loan with the same name), oldest first. */
export function personStatementRows(loans: Loan[], person: string): Row[] {
  const mine = loans.filter((l) => samePerson(l.person, person));
  const name = mine[0]?.person.trim() || person.trim();

  const events: { date: string; details: string; amount: number; order: number }[] = [];
  let net = 0; // + they owe you, − you owe them
  for (const l of mine) {
    const lent = l.direction === "lent";
    events.push({ date: l.date, details: lent ? `You gave to ${name}` : `You borrowed from ${name}`, amount: l.amount, order: 0 });
    const extra = Math.round((l.totalDue - l.amount) * 100) / 100;
    if (extra > 0) events.push({ date: l.date, details: "Interest / fees", amount: extra, order: 0.5 });
    net += lent ? l.totalDue : -l.totalDue;
    for (const p of l.payments) {
      events.push({ date: p.date, details: lent ? `${name} paid you back` : `You paid back ${name}`, amount: p.amount, order: 1 });
      net += lent ? -p.amount : p.amount;
    }
  }
  events.sort((a, b) => +new Date(a.date) - +new Date(b.date) || a.order - b.order);
  net = Math.round(net * 100) / 100;

  return [
    ["Date", "Details", "Amount (INR)"],
    ...events.map((e) => [csvDate(e.date), e.details, csvAmount(e.amount)]),
    [],
    ["", net > 0 ? `${name} owes you` : net < 0 ? `You owe ${name}` : "All settled", csvAmount(Math.abs(net))],
  ];
}
