import { describe, expect, it } from "vitest";
import { parseBudgetMonth } from "../budgetInput";

const NOW = new Date(Date.UTC(2026, 10, 22, 12)); // 22 Nov 2026

describe("parseBudgetMonth", () => {
  it("is optional: no month means no history entry", () => {
    expect(parseBudgetMonth(undefined, NOW)).toEqual({ ok: true, value: null });
    expect(parseBudgetMonth(null, NOW)).toEqual({ ok: true, value: null });
  });
  it("accepts the current month and one either side", () => {
    expect(parseBudgetMonth("2026-11", NOW)).toEqual({ ok: true, value: "2026-11" });
    expect(parseBudgetMonth("2026-10", NOW)).toEqual({ ok: true, value: "2026-10" });
    expect(parseBudgetMonth("2026-12", NOW)).toEqual({ ok: true, value: "2026-12" });
  });
  it("covers the hours when the user's month is ahead of UTC", () => {
    const lateOct = new Date(Date.UTC(2026, 9, 31, 20, 30)); // 02:00 IST on 1 Nov
    expect(parseBudgetMonth("2026-11", lateOct)).toEqual({ ok: true, value: "2026-11" });
  });
  it("works across a year end", () => {
    const dec = new Date(Date.UTC(2026, 11, 31, 20));
    expect(parseBudgetMonth("2027-01", dec)).toEqual({ ok: true, value: "2027-01" });
  });
  it("rejects a month that is far away", () => {
    expect(parseBudgetMonth("2026-09", NOW)).toEqual({ ok: false, error: "Month must be the current month." });
    expect(parseBudgetMonth("2027-11", NOW)).toEqual({ ok: false, error: "Month must be the current month." });
  });
  it("rejects anything that is not YYYY-MM", () => {
    for (const bad of ["2026-13", "nov", "2026-11-01", 202611, {}, true]) {
      expect(parseBudgetMonth(bad, NOW)).toEqual({ ok: false, error: "Month must look like 2026-11." });
    }
  });
});
