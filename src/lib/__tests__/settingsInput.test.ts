import { describe, expect, it } from "vitest";
import { parseBalanceInput, parseCardInput } from "../settingsInput";

describe("parseBalanceInput", () => {
  it("requires openingBalance", () => {
    expect(parseBalanceInput({})).toEqual({ ok: false, error: "openingBalance is required." });
  });
  it("null clears the balance and the unpaid card amount", () => {
    expect(parseBalanceInput({ openingBalance: null, cardDueAtAnchor: 500 })).toEqual({
      ok: true,
      value: { openingBalance: null, cardDueAtAnchor: null },
    });
  });
  it("balance without cardDueAtAnchor → unpaid card amount 0", () => {
    expect(parseBalanceInput({ openingBalance: 1000 })).toEqual({ ok: true, value: { openingBalance: 1000, cardDueAtAnchor: 0 } });
    expect(parseBalanceInput({ openingBalance: 1000, cardDueAtAnchor: "" })).toEqual({
      ok: true,
      value: { openingBalance: 1000, cardDueAtAnchor: 0 },
    });
  });
  it("accepts and rounds both amounts to paise", () => {
    expect(parseBalanceInput({ openingBalance: "10.005", cardDueAtAnchor: 2999.999 })).toEqual({
      ok: true,
      value: { openingBalance: 10.01, cardDueAtAnchor: 3000 },
    });
  });
  it("rejects bad balances", () => {
    expect(parseBalanceInput({ openingBalance: -1 }).ok).toBe(false);
    expect(parseBalanceInput({ openingBalance: "abc" }).ok).toBe(false);
    expect(parseBalanceInput({ openingBalance: "" }).ok).toBe(false);
    expect(parseBalanceInput({ openingBalance: true }).ok).toBe(false);
    expect(parseBalanceInput({ openingBalance: 2e10 })).toEqual({ ok: false, error: "Opening balance is too large." });
  });
  it("rejects a negative, non-numeric or huge unpaid card amount", () => {
    expect(parseBalanceInput({ openingBalance: 1, cardDueAtAnchor: -5 })).toEqual({
      ok: false,
      error: "Unpaid credit card amount must be 0 or more.",
    });
    expect(parseBalanceInput({ openingBalance: 1, cardDueAtAnchor: "x" }).ok).toBe(false);
    expect(parseBalanceInput({ openingBalance: 1, cardDueAtAnchor: 2e10 })).toEqual({
      ok: false,
      error: "Unpaid credit card amount is too large.",
    });
  });
});

describe("parseCardInput", () => {
  it("valid setup, with and without a limit", () => {
    expect(parseCardInput({ statementDay: 15, dueDay: 5 })).toEqual({ ok: true, value: { statementDay: 15, dueDay: 5 } });
    expect(parseCardInput({ statementDay: "1", dueDay: "20", limit: "50000.456" })).toEqual({
      ok: true,
      value: { statementDay: 1, dueDay: 20, limit: 50000.46 },
    });
    expect(parseCardInput({ statementDay: 28, dueDay: 1, limit: null })).toEqual({ ok: true, value: { statementDay: 28, dueDay: 1 } });
  });
  it("{ card: null } removes the card; other card values are rejected", () => {
    expect(parseCardInput({ card: null })).toEqual({ ok: true, value: null });
    expect(parseCardInput({ card: { statementDay: 1 } }).ok).toBe(false);
  });
  it("days must be whole numbers 1–28", () => {
    for (const bad of [0, 29, 31, 1.5, -1, "", null, undefined, true, "x"]) {
      expect(parseCardInput({ statementDay: bad, dueDay: 5 })).toEqual({
        ok: false,
        error: "Statement day must be a whole day between 1 and 28.",
      });
    }
    expect(parseCardInput({ statementDay: 10, dueDay: 29 })).toEqual({ ok: false, error: "Due day must be a whole day between 1 and 28." });
  });
  it("due day must differ from the statement day", () => {
    expect(parseCardInput({ statementDay: 10, dueDay: 10 }).ok).toBe(false);
  });
  it("limit must be > 0 and ≤ MAX_AMOUNT", () => {
    expect(parseCardInput({ statementDay: 10, dueDay: 1, limit: -1 })).toEqual({
      ok: false,
      error: "Credit limit must be more than zero (or leave it empty).",
    });
    expect(parseCardInput({ statementDay: 10, dueDay: 1, limit: 0 }).ok).toBe(false);
    expect(parseCardInput({ statementDay: 10, dueDay: 1, limit: 2e10 })).toEqual({ ok: false, error: "Credit limit is too large." });
  });
});
