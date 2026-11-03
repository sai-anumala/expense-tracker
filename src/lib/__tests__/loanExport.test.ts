import { describe, expect, it } from "vitest";
import { loansSummaryRows, personStatementRows } from "../loanExport";
import { iso, loan, local, payment } from "./fixtures";

const NOW = local(2026, 11, 3, 12);

describe("loansSummaryRows", () => {
  const open = loan({ person: "Ravi", direction: "lent", amount: 1000, date: iso(2026, 10, 1), payments: [payment(250, iso(2026, 10, 5))] });
  const overdue = loan({ person: "HDFC", source: "bank", direction: "borrowed", amount: 5000, totalDue: 5500, date: iso(2026, 9, 1), dueDate: iso(2026, 10, 31, 23, 59) });
  const settled = loan({ person: "Priya", direction: "lent", amount: 200, date: iso(2026, 10, 20), payments: [payment(200, iso(2026, 10, 25))] });

  it("header, one row per loan newest first, blank line, then totals of open loans", () => {
    expect(loansSummaryRows([open, overdue, settled], NOW)).toEqual([
      ["Person", "Type", "Date", "Total (INR)", "Repaid (INR)", "Remaining (INR)", "Status"],
      ["Priya", "Lent", "20/10/2026", "200.00", "200.00", "0.00", "Settled"],
      ["Ravi", "Lent", "01/10/2026", "1000.00", "250.00", "750.00", "Open"],
      ["HDFC", "Borrowed", "01/09/2026", "5500.00", "0.00", "5500.00", "Overdue"],
      [],
      ["You will get", "", "", "", "", "750.00"],
      ["You owe", "", "", "", "", "5500.00"],
    ]);
  });

  it("does not reorder the caller's array", () => {
    const input = [open, settled];
    loansSummaryRows(input, NOW);
    expect(input).toEqual([open, settled]);
  });

  it("no loans → header and zero totals", () => {
    expect(loansSummaryRows([], NOW)).toEqual([
      ["Person", "Type", "Date", "Total (INR)", "Repaid (INR)", "Remaining (INR)", "Status"],
      [],
      ["You will get", "", "", "", "", "0.00"],
      ["You owe", "", "", "", "", "0.00"],
    ]);
  });
});

describe("personStatementRows", () => {
  const lent = loan({
    person: "Ravi",
    direction: "lent",
    amount: 1000,
    totalDue: 1100,
    date: iso(2026, 10, 1, 10),
    payments: [payment(500, iso(2026, 10, 10)), payment(100, iso(2026, 10, 3))],
  });
  const borrowed = loan({ person: " RAVI ", direction: "borrowed", amount: 300, date: iso(2026, 10, 2), payments: [payment(300, iso(2026, 10, 6))] });
  const other = loan({ person: "Priya", direction: "lent", amount: 999, date: iso(2026, 10, 1) });

  it("covers every loan with that person (case-insensitive), oldest first, with interest line and net", () => {
    expect(personStatementRows([lent, other, borrowed], "ravi")).toEqual([
      ["Date", "Details", "Amount (INR)"],
      ["01/10/2026", "You gave to Ravi", "1000.00"],
      ["01/10/2026", "Interest / fees", "100.00"],
      ["02/10/2026", "You borrowed from Ravi", "300.00"],
      ["03/10/2026", "Ravi paid you back", "100.00"],
      ["06/10/2026", "You paid back Ravi", "300.00"],
      ["10/10/2026", "Ravi paid you back", "500.00"],
      [],
      // +1100 − 100 − 500 (lent) − 300 + 300 (borrowed) = 500
      ["", "Ravi owes you", "500.00"],
    ]);
  });

  it("a repayment on the same instant as the loan comes after it", () => {
    const same = loan({ person: "A", direction: "lent", amount: 50, date: iso(2026, 10, 1), payments: [payment(50, iso(2026, 10, 1))] });
    const rows = personStatementRows([same], "A");
    expect(rows.slice(1, 3).map((r) => r[1])).toEqual(["You gave to A", "A paid you back"]);
  });

  it("'You owe X' when borrowing outweighs lending, amount positive", () => {
    const b = loan({ person: "Bank", direction: "borrowed", amount: 2000, totalDue: 2250.5, date: iso(2026, 10, 1), payments: [payment(250, iso(2026, 10, 15))] });
    const rows = personStatementRows([b], "bank");
    expect(rows).toContainEqual(["01/10/2026", "Interest / fees", "250.50"]);
    expect(rows.at(-1)).toEqual(["", "You owe Bank", "2000.50"]);
  });

  it("'All settled' with 0.00 when everything is repaid", () => {
    const s = loan({ person: "Priya", direction: "lent", amount: 0.3, date: iso(2026, 10, 1), payments: [payment(0.1, iso(2026, 10, 2)), payment(0.2, iso(2026, 10, 3))] });
    expect(personStatementRows([s], "Priya").at(-1)).toEqual(["", "All settled", "0.00"]);
  });

  it("no interest line when totalDue equals amount", () => {
    const rows = personStatementRows([other], "Priya");
    expect(rows.map((r) => r[1])).not.toContain("Interest / fees");
  });

  it("unknown person → header, blank line, 'All settled' using the given name", () => {
    expect(personStatementRows([lent], "  Nobody ")).toEqual([["Date", "Details", "Amount (INR)"], [], ["", "All settled", "0.00"]]);
  });
});
