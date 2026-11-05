import { describe, expect, it } from "vitest";
import { iso, local, tx } from "./fixtures";
import {
  NO_FILTERS,
  PAGE_SIZE,
  accountChoices,
  categoryChoices,
  dateRangeLabel,
  dayFromValue,
  dayToValue,
  feedTotals,
  filterFeed,
  filtersFromParams,
  filtersToQuery,
  hasFilters,
  hiddenFilterCount,
  pageOf,
  periodRange,
  type TxFilters,
} from "../transactionFilters";
import { mergeFeed, type Transfer } from "../transfers";

const NOW = local(2026, 11, 6, 12);
const lunch = tx(-450, iso(2026, 11, 5, 13), { merchant: "Lunch at Swiggy", category: "food", account: "UPI" });
const rent = tx(-20000, iso(2026, 10, 31, 23, 59), { merchant: "Flat rent", category: "rent", account: "Bank Transfer" });
const pet = tx(-4500, iso(2026, 11, 1, 0), { merchant: "Vet", category: `custom:${"a".repeat(24)}`, account: "Credit Card" });
const salary = tx(90000, iso(2026, 11, 1, 9), { merchant: "Salary", category: "income", account: "Bank Transfer" });
const old = tx(-100, iso(2025, 3, 2, 9), { merchant: "Old tea", category: "food" });
const atm: Transfer = { id: "tr1", from: "bank", to: "cash", amount: 2000, date: iso(2026, 11, 2, 10), note: "ATM withdrawal" };
const bill: Transfer = { id: "tr2", from: "bank", to: "card", amount: 5000, date: iso(2026, 11, 3, 10) };
const feed = mergeFeed([lunch, rent, pet, salary, old], [atm, bill]);
const names = (id: string) => (id.startsWith("custom:") ? "Pet care" : id === "food" ? "Food & Dining" : id);
const run = (over: Partial<TxFilters>) => filterFeed(feed, { ...NO_FILTERS, ...over }, names, NOW).map((x) => x.item.id);
const ids = (...list: { id: string }[]) => list.map((x) => x.id);

describe("filterFeed", () => {
  it("shows everything, newest first, with no filters", () => {
    expect(run({})).toEqual(ids(lunch, bill, atm, salary, pet, rent, old));
  });
  it("separates expenses, income and transfers", () => {
    expect(run({ type: "expense" })).toEqual(ids(lunch, pet, rent, old));
    expect(run({ type: "income" })).toEqual(ids(salary));
    expect(run({ type: "transfer" })).toEqual(ids(bill, atm));
  });
  it("filters by category, leaving out income and transfers", () => {
    expect(run({ category: "food" })).toEqual(ids(lunch, old));
  });
  it("filters by account, including either side of a transfer", () => {
    expect(run({ account: "Credit Card" })).toEqual(ids(bill, pet));
    expect(run({ account: "Cash" })).toEqual(ids(atm));
    expect(run({ account: "Unspecified" })).toEqual(ids(old));
  });
  it("combines filters", () => {
    expect(run({ type: "expense", account: "Bank Transfer", period: "lastMonth" })).toEqual(ids(rent));
  });
  it("sorts by date and by size whatever the sign", () => {
    expect(run({ sort: "oldest" })[0]).toBe(old.id);
    expect(run({ sort: "highest" }).slice(0, 2)).toEqual(ids(salary, rent));
    expect(run({ sort: "lowest" })[0]).toBe(old.id);
  });
});

describe("search", () => {
  it.each([
    ["swiggy", [lunch]],
    ["LUNCH SWIGGY", [lunch]],
    ["pet care", [pet]],
    ["credit", [bill, pet]],
    ["4500", [pet]],
    ["4,500", [pet]],
    ["atm", [atm]],
    ["card bill", [bill]],
    ["  ", [lunch, bill, atm, salary, pet, rent, old]],
    ["nothing like this", []],
  ])("%s", (q, want) => {
    expect(run({ q })).toEqual(ids(...want));
  });
});

describe("dates", () => {
  it("keeps month edges in the right month", () => {
    expect(run({ period: "thisMonth" })).toEqual(ids(lunch, bill, atm, salary, pet));
    expect(run({ period: "lastMonth" })).toEqual(ids(rent));
  });
  it("this year and last 30 days", () => {
    expect(run({ period: "thisYear" })).not.toContain(old.id);
    const [start, end] = periodRange({ period: "last30", from: "", to: "" }, NOW);
    expect(start).toEqual(local(2026, 10, 8));
    expect(end).toEqual(local(2026, 11, 7));
  });
  it("custom range includes both end days", () => {
    expect(run({ period: "custom", from: "2026-11-01", to: "2026-11-02" })).toEqual(ids(atm, salary, pet));
  });
  it("custom range can be open-ended or reversed", () => {
    expect(run({ period: "custom", from: "2026-11-03" })).toEqual(ids(lunch, bill));
    expect(run({ period: "custom", to: "2025-12-31" })).toEqual(ids(old));
    expect(run({ period: "custom", from: "2026-11-02", to: "2026-11-01" })).toEqual(ids(atm, salary, pet));
  });
  it("ignores from and to unless custom is chosen, and bad dates", () => {
    expect(run({ from: "2026-11-05" })).toHaveLength(7);
    expect(run({ period: "custom", from: "nonsense" })).toHaveLength(7);
  });
});

describe("feedTotals", () => {
  it("never counts a transfer as spent or received", () => {
    expect(feedTotals(feed)).toEqual({ spent: 25050, received: 90000, moved: 7000 });
  });
});

describe("choices", () => {
  it("only offers what's in the data", () => {
    expect(accountChoices(feed)).toEqual(["Bank", "Bank Transfer", "Cash", "Credit Card", "Unspecified", "UPI"]);
    expect(categoryChoices(feed)).toEqual(expect.arrayContaining(["food", "rent", pet.category]));
    expect(categoryChoices(feed)).not.toContain("income");
  });
});

describe("pageOf", () => {
  const list = Array.from({ length: 23 }, (_, i) => i);
  it("gives 10 per page", () => {
    expect(PAGE_SIZE).toBe(10);
    expect(pageOf(list, 1).items).toHaveLength(10);
    expect(pageOf(list, 3)).toEqual({ items: [20, 21, 22], current: 3, pages: 3 });
  });
  it("keeps the page in range", () => {
    expect(pageOf(list, 99).current).toBe(3);
    expect(pageOf(list, -1).current).toBe(1);
    expect(pageOf(list, NaN).current).toBe(1);
    expect(pageOf([], 1)).toEqual({ items: [], current: 1, pages: 1 });
  });
});

describe("URL", () => {
  it("round-trips and stays short", () => {
    const f: TxFilters = { ...NO_FILTERS, q: "a b", type: "income", period: "custom", from: "2026-01-01", sort: "highest", account: "Credit Card" };
    const query = filtersToQuery(f, 3);
    const p = new URLSearchParams(query);
    expect(filtersFromParams((k) => p.get(k))).toEqual({ filters: f, page: 3 });
    expect(filtersToQuery(NO_FILTERS, 1)).toBe("");
  });
  it("ignores values it doesn't know", () => {
    const p = new URLSearchParams("type=hack&period=x&sort=y&page=abc");
    expect(filtersFromParams((k) => p.get(k))).toEqual({ filters: NO_FILTERS, page: 1 });
  });
});

describe("counts", () => {
  it("counts the options behind the button", () => {
    expect(hiddenFilterCount(NO_FILTERS)).toBe(0);
    expect(hiddenFilterCount({ ...NO_FILTERS, period: "last30", account: "UPI", q: "x" })).toBe(2);
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, type: "income" })).toBe(true);
  });
});

describe("date range helpers", () => {
  it("labels ranges", () => {
    expect(dateRangeLabel("", "")).toBe("");
    expect(dateRangeLabel("2026-10-01", "2026-11-06")).toBe("1 Oct – 6 Nov 2026");
    expect(dateRangeLabel("2025-12-01", "2026-01-06")).toBe("1 Dec 2025 – 6 Jan 2026");
    expect(dateRangeLabel("2026-11-06", "2026-11-06")).toBe("6 Nov 2026");
    expect(dateRangeLabel("2026-10-01", "")).toBe("From 1 Oct 2026");
    expect(dateRangeLabel("", "2026-10-01")).toBe("Until 1 Oct 2026");
    expect(dateRangeLabel("nonsense", "")).toBe("");
  });
  it("round-trips local days", () => {
    expect(dayToValue(dayFromValue("2026-03-09")!)).toBe("2026-03-09");
    expect(dayFromValue("x")).toBeNull();
  });
});
