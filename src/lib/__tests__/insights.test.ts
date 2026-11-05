import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  anchoredBalance,
  categoryInsight,
  net,
  periodBounds,
  spentByCategory,
  topMerchants,
  totalIncome,
  totalSpent,
  weeklySpend,
  within,
  budgetLeftLevel,
  budgetStatus,
} from "../insights";
import { iso, local, tx } from "./fixtures";

// "Now" for every test: Tuesday 3 Nov 2026, 12:00 local.
const NOW = local(2026, 11, 3, 12);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("periodBounds", () => {
  it("week starts on Monday and lasts 7 days", () => {
    expect(periodBounds("week", NOW)).toEqual([local(2026, 11, 2), local(2026, 11, 9)]);
  });

  it("a Sunday belongs to the week that started the previous Monday", () => {
    expect(periodBounds("week", local(2026, 11, 8, 23, 59))).toEqual([local(2026, 11, 2), local(2026, 11, 9)]);
    expect(periodBounds("week", local(2026, 11, 1, 10))).toEqual([local(2026, 10, 26), local(2026, 11, 2)]);
  });

  it("a Monday at midnight starts its own week", () => {
    expect(periodBounds("week", local(2026, 11, 2))[0]).toEqual(local(2026, 11, 2));
  });

  it("week `back` offsets shift by whole weeks", () => {
    expect(periodBounds("week", NOW, 1)).toEqual([local(2026, 10, 26), local(2026, 11, 2)]);
    expect(periodBounds("week", NOW, 3)).toEqual([local(2026, 10, 12), local(2026, 10, 19)]);
  });

  it("month is 1st 00:00 to next 1st, with year rollover on `back`", () => {
    expect(periodBounds("month", NOW)).toEqual([local(2026, 11, 1), local(2026, 12, 1)]);
    expect(periodBounds("month", NOW, 1)).toEqual([local(2026, 10, 1), local(2026, 11, 1)]);
    expect(periodBounds("month", local(2026, 1, 15), 1)).toEqual([local(2025, 12, 1), local(2026, 1, 1)]);
    expect(periodBounds("month", local(2026, 12, 31))).toEqual([local(2026, 12, 1), local(2027, 1, 1)]);
  });

  it("year is 1 Jan to next 1 Jan", () => {
    expect(periodBounds("year", NOW)).toEqual([local(2026, 1, 1), local(2027, 1, 1)]);
    expect(periodBounds("year", NOW, 2)).toEqual([local(2024, 1, 1), local(2025, 1, 1)]);
  });

  it("defaults to now", () => {
    expect(periodBounds("month")).toEqual([local(2026, 11, 1), local(2026, 12, 1)]);
  });
});

describe("within", () => {
  it("includes the start instant and excludes the end instant", () => {
    const bounds = periodBounds("month", NOW);
    const atStart = tx(-1, iso(2026, 11, 1));
    const lastMs = tx(-2, new Date(local(2026, 12, 1).getTime() - 1).toISOString());
    const atEnd = tx(-3, iso(2026, 12, 1));
    const before = tx(-4, new Date(local(2026, 11, 1).getTime() - 1).toISOString());
    expect(within([atStart, lastMs, atEnd, before], bounds)).toEqual([atStart, lastMs]);
  });
});

describe("totals", () => {
  const list = [tx(-100.5, iso(2026, 11, 1)), tx(-20, iso(2026, 11, 2)), tx(500, iso(2026, 11, 2)), tx(0.25, iso(2026, 11, 3))];

  it("totalSpent is a positive sum of expenses only", () => {
    expect(totalSpent(list)).toBeCloseTo(120.5);
  });
  it("totalIncome sums positive amounts only", () => {
    expect(totalIncome(list)).toBeCloseTo(500.25);
  });
  it("net sums signed amounts", () => {
    expect(net(list)).toBeCloseTo(379.75);
    expect(net([])).toBe(0);
  });
  it("empty lists are zero", () => {
    expect(totalSpent([])).toBe(0);
    expect(totalIncome([])).toBe(0);
  });
});

describe("spentByCategory", () => {
  it("sums expenses per category, largest first, ignoring income", () => {
    const list = [
      tx(-50, iso(2026, 11, 1), { category: "food" }),
      tx(-300, iso(2026, 11, 1), { category: "rent" }),
      tx(-75, iso(2026, 11, 2), { category: "food" }),
      tx(-10, iso(2026, 11, 2), { category: "fun" }),
      tx(1000, iso(2026, 11, 2), { category: "income" }),
    ];
    expect(spentByCategory(list)).toEqual([
      { category: "rent", amount: 300 },
      { category: "food", amount: 125 },
      { category: "fun", amount: 10 },
    ]);
  });
});

describe("topMerchants", () => {
  it("merges merchants case-insensitively and ignoring surrounding spaces, keeping the first spelling", () => {
    const list = [
      tx(-100, iso(2026, 11, 1), { merchant: "Swiggy" }),
      tx(-50, iso(2026, 11, 2), { merchant: " swiggy " }),
      tx(-120, iso(2026, 11, 2), { merchant: "Uber", category: "transport" }),
      tx(-5, iso(2026, 11, 2), { merchant: "Chai" }),
      tx(9999, iso(2026, 11, 2), { merchant: "Salary" }),
    ];
    const top = topMerchants(list);
    expect(top).toEqual([
      { name: "Swiggy", amount: 150, count: 2, category: "food" },
      { name: "Uber", amount: 120, count: 1, category: "transport" },
      { name: "Chai", amount: 5, count: 1, category: "food" },
    ]);
  });

  it("respects n", () => {
    const list = [tx(-1, iso(2026, 11, 1), { merchant: "A" }), tx(-2, iso(2026, 11, 1), { merchant: "B" })];
    expect(topMerchants(list, 1).map((m) => m.name)).toEqual(["B"]);
  });
});

describe("weeklySpend", () => {
  it("returns the last 4 Monday-start weeks oldest first, current week flagged last", () => {
    const list = [
      tx(-10, iso(2026, 11, 3, 9)), // this week
      tx(-20, iso(2026, 11, 1, 23)), // Sunday → previous week
      tx(-40, iso(2026, 10, 12)), // 3 weeks back (Monday)
      tx(-80, iso(2026, 10, 11)), // 4 weeks back → outside
      tx(500, iso(2026, 11, 3, 8)), // income ignored
    ];
    const weeks = weeklySpend(list);
    expect(weeks.map((w) => w.start)).toEqual([local(2026, 10, 12), local(2026, 10, 19), local(2026, 10, 26), local(2026, 11, 2)]);
    expect(weeks.map((w) => w.amount)).toEqual([40, 0, 20, 10]);
    expect(weeks.map((w) => w.current)).toEqual([false, false, false, true]);
  });
});

describe("categoryInsight", () => {
  it("picks the category with the biggest % change present in both months", () => {
    const list = [
      tx(-100, iso(2026, 10, 5), { category: "food" }),
      tx(-150, iso(2026, 11, 2), { category: "food" }), // +50%
      tx(-200, iso(2026, 10, 5), { category: "fun" }),
      tx(-50, iso(2026, 11, 2), { category: "fun" }), // −75% (bigger magnitude)
      tx(-5000, iso(2026, 11, 2), { category: "rent" }), // not in last month → ignored
    ];
    expect(categoryInsight(list)).toEqual({ category: "fun", pct: -75 });
  });

  it("returns null when no category appears in both months", () => {
    expect(categoryInsight([tx(-100, iso(2026, 11, 2)), tx(-100, iso(2026, 10, 2), { category: "fun" })])).toBeNull();
  });

  it("returns null when the change rounds to 0%", () => {
    const list = [tx(-1000, iso(2026, 10, 5)), tx(-1004, iso(2026, 11, 2))];
    expect(categoryInsight(list)).toBeNull();
  });
});

describe("anchoredBalance (AGENTS.md §11)", () => {
  const monthStart = local(2026, 11, 1);

  it("null entered balance → balance 0, base null, nothing counted", () => {
    expect(anchoredBalance([tx(-50, iso(2026, 11, 2))], null, iso(2026, 11, 1), monthStart)).toEqual({
      balance: 0,
      base: null,
      counted: [],
    });
  });

  it("missing anchor date → entered amount, base null", () => {
    expect(anchoredBalance([tx(-50, iso(2026, 11, 2))], 1000, null, monthStart)).toEqual({ balance: 1000, base: null, counted: [] });
  });

  it("spec example: ₹10,000 at 4:30 PM ignores a 2 PM expense, counts a 4:30 PM one (same instant)", () => {
    const asOf = iso(2026, 11, 3, 16, 30);
    const early = tx(-500, iso(2026, 11, 3, 14));
    const same = tx(-50, asOf);
    const r = anchoredBalance([early, same], 10_000, asOf, monthStart);
    expect(r.balance).toBe(9_950);
    expect(r.counted).toEqual([same]);
  });

  it("counts income, expenses and loan cash events dated after the anchor", () => {
    const asOf = iso(2026, 11, 2, 10);
    const list = [
      tx(-200, iso(2026, 11, 2, 11)),
      tx(1500, iso(2026, 11, 3, 9)),
      { amount: -1000, date: iso(2026, 11, 3, 10) }, // lent to a friend
    ];
    expect(anchoredBalance(list, 5000, asOf, monthStart).balance).toBe(5300);
  });

  it("anchor this month → base is the entered amount", () => {
    const asOf = iso(2026, 11, 2, 10);
    const r = anchoredBalance([tx(-200, iso(2026, 11, 2, 11))], 5000, asOf, monthStart);
    expect(r.base).toBe(5000);
  });

  it("anchor exactly at month start counts as this month", () => {
    expect(anchoredBalance([], 5000, monthStart.toISOString(), monthStart).base).toBe(5000);
  });

  it("anchor before this month → base = entered + net of [anchor, 1st), never items before the anchor", () => {
    const asOf = iso(2026, 10, 20, 12);
    const list = [
      tx(-9999, iso(2026, 10, 19)), // before anchor: ignored everywhere
      tx(-300, iso(2026, 10, 25)), // between anchor and 1st: in base and balance
      tx(2000, iso(2026, 10, 31, 23, 59)),
      tx(-100, iso(2026, 11, 1)), // this month: balance only
    ];
    const r = anchoredBalance(list, 1000, asOf, monthStart);
    expect(r.base).toBe(2700);
    expect(r.balance).toBe(2600);
    expect(r.counted).toHaveLength(3);
  });

  it("entered 0 is a real balance (not 'not set')", () => {
    const r = anchoredBalance([tx(-10, iso(2026, 11, 3))], 0, iso(2026, 11, 2), monthStart);
    expect(r).toMatchObject({ balance: -10, base: 0 });
  });
});

describe("budgetStatus", () => {
  it("follows the Overview pill rule", () => {
    expect(budgetStatus(0)).toBe("On track");
    expect(budgetStatus(0.849)).toBe("On track");
    expect(budgetStatus(0.85)).toBe("Watch spend");
    expect(budgetStatus(1)).toBe("Watch spend");
    expect(budgetStatus(1.01)).toBe("Over budget");
  });
});

describe("budgetLeftLevel", () => {
  it("turns low under 30% left and over past the limit", () => {
    expect(budgetLeftLevel(1000, 0)).toBe("ok");
    expect(budgetLeftLevel(1000, 700)).toBe("ok"); // exactly 30% left isn't under 30%
    expect(budgetLeftLevel(1000, 700.5)).toBe("low");
    expect(budgetLeftLevel(1000, 1000)).toBe("low");
    expect(budgetLeftLevel(1000, 1000.5)).toBe("over");
  });
  it("is calm with no budget set", () => {
    expect(budgetLeftLevel(0, 500)).toBe("ok");
  });
});
