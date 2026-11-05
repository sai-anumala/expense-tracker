// All Transactions screen: pure filter, sort and paging logic. Transfers stay separate from income and spending.
import type { Transaction } from "./data";
import { transferAccountLabels, transferRoute, transferType, type FeedItem } from "./transfers";

export const PAGE_SIZE = 10;
export const NO_ACCOUNT = "Unspecified";

export const FILTER_TYPES = ["all", "expense", "income", "transfer"] as const;
export const FILTER_PERIODS = ["any", "thisMonth", "lastMonth", "last30", "thisYear", "custom"] as const;
export const FILTER_SORTS = ["newest", "oldest", "highest", "lowest"] as const;

export type TxFilters = {
  /** Free text: name or note, category, account, or part of an amount. */
  q: string;
  type: (typeof FILTER_TYPES)[number];
  period: (typeof FILTER_PERIODS)[number];
  /** yyyy-mm-dd, local; both inclusive; only used when period is "custom". */
  from: string;
  to: string;
  category: string;
  account: string;
  sort: (typeof FILTER_SORTS)[number];
};

export const NO_FILTERS: TxFilters = { q: "", type: "all", period: "any", from: "", to: "", category: "", account: "", sort: "newest" };

type Feed = FeedItem<Transaction>;

function localDay(value: string, plusDays = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + plusDays);
}

/** [start, end) of the chosen dates; null means open-ended. A reversed custom range is read the right way round. */
export function periodRange(f: Pick<TxFilters, "period" | "from" | "to">, now = new Date()): [Date | null, Date | null] {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (f.period) {
    case "thisMonth":
      return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case "lastMonth":
      return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case "last30":
      return [new Date(y, m, now.getDate() - 29), new Date(y, m, now.getDate() + 1)];
    case "thisYear":
      return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    case "custom": {
      const [a, b] = f.from && f.to && f.from > f.to ? [f.to, f.from] : [f.from, f.to];
      return [localDay(a), localDay(b, 1)];
    }
    default:
      return [null, null];
  }
}

const accountsOf = (x: Feed) =>
  x.kind === "transfer" ? [transferAccountLabels[x.item.from], transferAccountLabels[x.item.to]] : [x.item.account || NO_ACCOUNT];

const amountOf = (x: Feed) => Math.abs(x.item.amount);

function searchText(x: Feed, categoryName: (id: string) => string) {
  const words =
    x.kind === "transfer"
      ? [x.item.note ?? "", transferType(x.item), transferRoute(x.item)]
      : [x.item.merchant, categoryName(x.item.category), x.item.account ?? ""];
  return `${words.join(" ")} ${amountOf(x).toFixed(2)}`.toLowerCase();
}

/** Filtered and sorted. `feed` is newest first (mergeFeed); equal amounts keep that order. */
export function filterFeed(feed: Feed[], f: TxFilters, categoryName: (id: string) => string, now = new Date()): Feed[] {
  const [start, end] = periodRange(f, now);
  // Amounts are stored without commas, so "4,500" should still find 4500.00.
  const terms = f.q.toLowerCase().replace(/(\d),(?=\d)/g, "$1").split(/\s+/).filter(Boolean);
  const list = feed.filter((x) => {
    if (f.type === "transfer" && x.kind !== "transfer") return false;
    if (f.type === "expense" && !(x.kind === "transaction" && x.item.amount < 0)) return false;
    if (f.type === "income" && !(x.kind === "transaction" && x.item.amount > 0)) return false;
    if (f.category && !(x.kind === "transaction" && x.item.category === f.category)) return false;
    if (f.account && !accountsOf(x).includes(f.account)) return false;
    const when = new Date(x.date);
    if ((start && when < start) || (end && when >= end)) return false;
    if (terms.length === 0) return true;
    const text = searchText(x, categoryName);
    return terms.every((t) => text.includes(t));
  });
  const time = (x: Feed) => +new Date(x.date);
  if (f.sort === "oldest") list.sort((a, b) => time(a) - time(b));
  else if (f.sort === "highest") list.sort((a, b) => amountOf(b) - amountOf(a));
  else if (f.sort === "lowest") list.sort((a, b) => amountOf(a) - amountOf(b));
  return list;
}

/** Totals of a filtered list. Transfers only ever count as moved, never as spent or received. */
export function feedTotals(list: Feed[]) {
  const t = { spent: 0, received: 0, moved: 0 };
  for (const x of list) {
    if (x.kind === "transfer") t.moved += x.item.amount;
    else if (x.item.amount < 0) t.spent -= x.item.amount;
    else t.received += x.item.amount;
  }
  return t;
}

/** Accounts that actually appear in the data, so no choice leads to an empty list. */
export const accountChoices = (feed: Feed[]) => [...new Set(feed.flatMap(accountsOf))].sort((a, b) => a.localeCompare(b));

/** Expense categories that actually appear in the data. */
export const categoryChoices = (feed: Feed[]) => [
  ...new Set(feed.flatMap((x) => (x.kind === "transaction" && x.item.amount < 0 ? [x.item.category as string] : []))),
];

/** How many of the options behind the Filters button are set. */
export const hiddenFilterCount = (f: TxFilters) =>
  Number(f.period !== "any") + Number(Boolean(f.category)) + Number(Boolean(f.account)) + Number(f.sort !== "newest");

export const hasFilters = (f: TxFilters) => hiddenFilterCount(f) > 0 || f.type !== "all" || f.q.trim() !== "";

export function pageOf<T>(list: T[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const first = (current - 1) * PAGE_SIZE;
  return { items: list.slice(first, first + PAGE_SIZE), current, pages };
}

const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T) => (list.includes(v as T) ? (v as T) : fallback);

/** Filters and page live in the URL, so Back from an edit and a refresh return to the same view. */
export function filtersFromParams(get: (key: string) => string | null): { filters: TxFilters; page: number } {
  return {
    filters: {
      q: get("q") ?? "",
      type: oneOf(FILTER_TYPES, get("type"), "all"),
      period: oneOf(FILTER_PERIODS, get("period"), "any"),
      from: get("from") ?? "",
      to: get("to") ?? "",
      category: get("category") ?? "",
      account: get("account") ?? "",
      sort: oneOf(FILTER_SORTS, get("sort"), "newest"),
    },
    page: Number(get("page")) || 1,
  };
}

export function filtersToQuery(f: TxFilters, page: number) {
  const p = new URLSearchParams();
  for (const k of Object.keys(NO_FILTERS) as (keyof TxFilters)[]) {
    if (f[k] && f[k] !== NO_FILTERS[k]) p.set(k, f[k]);
  }
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
