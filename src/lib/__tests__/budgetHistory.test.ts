import { describe, expect, it } from "vitest";
import {
  HISTORY_CAP,
  budgetForMonth,
  isMonthKey,
  monthBounds,
  monthIndex,
  monthKey,
  monthKeyLabel,
  monthSummaries,
  upsertHistory,
} from "../budgetHistory";
import type { Budget, BudgetEntry, CategoryId } from "../data";
import { iso, local, tx } from "./fixtures";

const entry = (month: string, monthlyLimit: number, cats: [string, number][] = []): BudgetEntry => ({
  month,
  monthlyLimit,
  categories: cats.map(([category, limit]) => ({ category: category as CategoryId, limit })),
});

describe("month keys", () => {
  it("formats a local date", () => {
    expect(monthKey(local(2026, 11, 22, 9))).toBe("2026-11");
    expect(monthKey(local(2026, 1, 1, 0, 0))).toBe("2026-01");
  });
  it("accepts only YYYY-MM with a real month", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey("2026-11-01")).toBe(false);
    expect(isMonthKey(202611)).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });
  it("counts months so keys compare across a year end", () => {
    expect(monthIndex("2027-01") - monthIndex("2026-12")).toBe(1);
    expect(monthIndex("nope")).toBeNaN();
  });
  it("gives local [start, end) bounds, including December", () => {
    expect(monthBounds("2026-10")).toEqual([local(2026, 10, 1), local(2026, 11, 1)]);
    expect(monthBounds("2026-12")).toEqual([local(2026, 12, 1), local(2027, 1, 1)]);
  });
  it("labels a month", () => {
    expect(monthKeyLabel("2026-10")).toBe("October 2026");
  });
});

describe("budgetForMonth", () => {
  const live: Budget = {
    monthlyLimit: 60000,
    categories: [{ category: "food", limit: 6500 }],
    history: [entry("2026-09", 40000, [["food", 4000]]), entry("2026-11", 60000, [["food", 6500]])],
  };

  it("uses the live budget for the current month", () => {
    expect(budgetForMonth(live, "2026-11", "2026-11")).toEqual({
      monthlyLimit: 60000,
      categories: [{ category: "food", limit: 6500 }],
      recorded: true,
    });
  });
  it("uses the entry saved in that month", () => {
    expect(budgetForMonth(live, "2026-09", "2026-11")).toMatchObject({ monthlyLimit: 40000, recorded: true });
  });
  it("carries a limit forward until it is changed", () => {
    expect(budgetForMonth(live, "2026-10", "2026-11")).toMatchObject({ monthlyLimit: 40000, recorded: true });
  });
  it("uses the earliest saved limit before the first one, and says it was not recorded", () => {
    expect(budgetForMonth(live, "2026-06", "2026-11")).toMatchObject({ monthlyLimit: 40000, recorded: false });
  });
  it("falls back to the live budget when there is no history at all", () => {
    expect(budgetForMonth({ monthlyLimit: 5000, categories: [] }, "2026-10", "2026-11")).toEqual({
      monthlyLimit: 5000,
      categories: [],
      recorded: false,
    });
  });
  it("does not depend on the order of the history", () => {
    const shuffled: Budget = { ...live, history: [...live.history!].reverse() };
    expect(budgetForMonth(shuffled, "2026-10", "2026-11")).toMatchObject({ monthlyLimit: 40000 });
  });
  it("drops categories that no longer exist", () => {
    const b: Budget = { monthlyLimit: 1, categories: [], history: [entry("2026-10", 100, [["food", 10], ["custom:gone", 5]])] };
    expect(budgetForMonth(b, "2026-10", "2026-11", (c) => c !== "custom:gone").categories).toEqual([{ category: "food", limit: 10 }]);
  });
  it("works across a year end", () => {
    const b: Budget = { monthlyLimit: 9, categories: [], history: [entry("2026-12", 700)] };
    expect(budgetForMonth(b, "2027-01", "2027-02")).toMatchObject({ monthlyLimit: 700, recorded: true });
  });
});

describe("upsertHistory", () => {
  it("adds an entry, oldest first", () => {
    const out = upsertHistory([entry("2026-11", 2)], entry("2026-10", 1));
    expect(out.map((e) => e.month)).toEqual(["2026-10", "2026-11"]);
  });
  it("replaces the entry for the same month (last save wins)", () => {
    const out = upsertHistory([entry("2026-11", 2)], entry("2026-11", 3));
    expect(out).toEqual([entry("2026-11", 3)]);
  });
  it("keeps only the newest entries", () => {
    let h: BudgetEntry[] = [];
    for (let i = 0; i < HISTORY_CAP + 4; i++) {
      const d = new Date(2020, i, 1);
      h = upsertHistory(h, entry(monthKey(d), i));
    }
    expect(h).toHaveLength(HISTORY_CAP);
    expect(h[0].monthlyLimit).toBe(4);
    expect(h[h.length - 1].monthlyLimit).toBe(HISTORY_CAP + 3);
  });
  it("does not change the input", () => {
    const before = [entry("2026-11", 2)];
    upsertHistory(before, entry("2026-12", 3));
    expect(before).toHaveLength(1);
  });
});

describe("monthSummaries", () => {
  const budget: Budget = { monthlyLimit: 1, categories: [], history: [entry("2026-08", 1)] };

  it("always lists the current month, newest first, with expenses only", () => {
    const list = monthSummaries(
      [tx(-100, iso(2026, 10, 5)), tx(-50, iso(2026, 10, 9)), tx(900, iso(2026, 10, 1)), tx(-7, iso(2026, 11, 2))],
      budget,
      "2026-11",
    );
    expect(list).toEqual([
      { month: "2026-11", spent: 7 },
      { month: "2026-10", spent: 150 },
      { month: "2026-08", spent: 0 },
    ]);
  });
  it("lists the current month even with no data", () => {
    expect(monthSummaries([], { monthlyLimit: 0, categories: [] }, "2026-11")).toEqual([{ month: "2026-11", spent: 0 }]);
  });
  it("never lists a future month", () => {
    const list = monthSummaries([tx(-5, iso(2027, 2, 1))], { monthlyLimit: 0, categories: [], history: [entry("2027-03", 1)] }, "2026-11");
    expect(list.map((m) => m.month)).toEqual(["2026-11"]);
  });
  it("skips months with no transaction or saved budget", () => {
    const list = monthSummaries([tx(-5, iso(2026, 6, 1))], { monthlyLimit: 0, categories: [] }, "2026-11");
    expect(list.map((m) => m.month)).toEqual(["2026-11", "2026-06"]);
  });
  it("puts a month by its local date, not UTC", () => {
    // 00:30 IST on 1 Nov is still 31 Oct in UTC.
    const list = monthSummaries([tx(-10, iso(2026, 11, 1, 0, 30))], { monthlyLimit: 0, categories: [] }, "2026-11");
    expect(list).toEqual([{ month: "2026-11", spent: 10 }]);
  });
});
