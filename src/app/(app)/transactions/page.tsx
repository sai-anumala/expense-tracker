"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ReceiptText, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { TabPage } from "@/components/BottomNav";
import { DateRangeDialog, DateRangeField } from "@/components/DateRangePicker";
import { Pagination } from "@/components/Pagination";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { TransferRow } from "@/components/TransferRow";
import { AppHeader, PageColumns, RowHint } from "@/components/ui";
import { dayBucket, money, plural } from "@/lib/format";
import { useAppData } from "@/lib/store";
import {
  NO_FILTERS,
  accountChoices,
  categoryChoices,
  feedTotals,
  filterFeed,
  filtersFromParams,
  filtersToQuery,
  hasFilters,
  hiddenFilterCount,
  pageOf,
  type TxFilters,
} from "@/lib/transactionFilters";
import { mergeFeed } from "@/lib/transfers";

const typeTabs: { id: TxFilters["type"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfers" },
];

const periods: { id: TxFilters["period"]; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisYear", label: "This year" },
  { id: "custom", label: "Custom dates" },
];

const sorts: { id: TxFilters["sort"]; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "highest", label: "Highest amount" },
  { id: "lowest", label: "Lowest amount" },
];

export default function AllTransactionsPage() {
  return (
    <Suspense>
      <AllTransactions />
    </Suspense>
  );
}

function AllTransactions() {
  const params = useSearchParams();
  const { transactions, transfers, categoryOf } = useAppData();
  const [{ filters, page }, setView] = useState(() => filtersFromParams((k) => params.get(k)));
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickingDates, setPickingDates] = useState(false);
  const listRef = useRef<HTMLElement>(null);

  const feed = useMemo(() => mergeFeed(transactions, transfers), [transactions, transfers]);
  const categoryName = (id: string) => categoryOf(id).long;
  const shown = filterFeed(feed, filters, categoryName);
  const totals = feedTotals(shown);
  const { items, current, pages } = pageOf(shown, page);

  // Mirror the view in the URL without a navigation, so Back and refresh return here.
  useEffect(() => {
    window.history.replaceState(window.history.state, "", `/transactions${filtersToQuery(filters, current)}`);
  }, [filters, current]);

  // Any change of filter starts again at page 1.
  const patch = (change: Partial<TxFilters>) => setView({ filters: { ...filters, ...change }, page: 1 });
  const goTo = (n: number) => {
    setView({ filters, page: n });
    listRef.current?.scrollIntoView({ block: "start" });
  };

  const categoryIds = categoryChoices(feed);
  if (filters.category && !categoryIds.includes(filters.category)) categoryIds.push(filters.category);
  const categoryOptions = categoryIds
    .map((id) => ({ id, label: categoryName(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const accounts = accountChoices(feed);
  if (filters.account && !accounts.includes(filters.account)) accounts.push(filters.account);
  const categoryApplies = filters.type === "all" || filters.type === "expense";
  const hidden = hiddenFilterCount(filters);
  const filtered = hasFilters(filters);

  // Same-day rows that sit next to each other share one date header, in any sort order.
  const groups: { day: string; list: typeof items }[] = [];
  for (const x of items) {
    const day = dayBucket(x.date);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.list.push(x);
    else groups.push({ day, list: [x] });
  }

  return (
    <>
      <AppHeader subtitle="All Transactions" />
      <TabPage>
        {feed.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            body="Add your first expense or income and it will show up here."
            action={
              <Link href="/add" className="rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
                Add transaction
              </Link>
            }
          />
        ) : (
          <PageColumns>
            <div className="min-w-0 space-y-3 lg:sticky lg:top-20">
              <label className="card flex items-center gap-3 rounded-full py-1 pr-1 pl-4">
                <Search className="size-5 shrink-0 text-on-surface-variant" aria-hidden />
                <input
                  type="search"
                  aria-label="Search transactions"
                  value={filters.q}
                  onChange={(e) => patch({ q: e.target.value })}
                  placeholder="Search name, category or amount"
                  className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-outline [&::-webkit-search-cancel-button]:hidden"
                />
                {filters.q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => patch({ q: "" })}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </label>

              <div role="tablist" aria-label="Type" className="grid grid-cols-4 rounded-full bg-surface-container-high p-1 text-sm max-[340px]:text-xs">
                {typeTabs.map(({ id, label }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={filters.type === id}
                    onClick={() => patch({ type: id, category: id === "all" || id === "expense" ? filters.category : "" })}
                    className={`rounded-full py-2 transition ${
                      filters.type === id ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-expanded={panelOpen}
                aria-controls="transaction-filters"
                onClick={() => setPanelOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm font-medium transition hover:bg-surface-container lg:hidden"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                <span className="flex-1 text-left">Date, category, account, sort</span>
                {hidden > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs tabular-nums text-on-primary">{hidden}</span>
                )}
                <ChevronDown className={`size-4 transition ${panelOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>

              <div id="transaction-filters" className={`card grid grid-cols-2 gap-2 p-3 ${panelOpen ? "" : "hidden lg:grid"}`}>
                <FilterSelect
                  label="Date"
                  value={filters.period}
                  onChange={(v) => {
                    patch({ period: v as TxFilters["period"] });
                    if (v === "custom" && !filters.from && !filters.to) setPickingDates(true);
                  }}
                >
                  {periods.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect label="Sort" value={filters.sort} onChange={(v) => patch({ sort: v as TxFilters["sort"] })}>
                  {sorts.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </FilterSelect>
                {filters.period === "custom" && <DateRangeField from={filters.from} to={filters.to} onOpen={() => setPickingDates(true)} />}
                <FilterSelect
                  label="Category"
                  value={filters.category}
                  disabled={!categoryApplies}
                  onChange={(v) => patch({ category: v })}
                >
                  <option value="">All categories</option>
                  {categoryOptions.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect label="Account" value={filters.account} onChange={(v) => patch({ account: v })}>
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-sm tabular-nums" role="status">
                <span className="font-semibold">{plural(shown.length, "transaction")}</span>
                {filtered && (
                  <button
                    type="button"
                    onClick={() => setView({ filters: NO_FILTERS, page: 1 })}
                    className="font-medium text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
                {shown.length > 0 && (
                  <span className="w-full text-on-surface-variant">
                    {[
                      totals.spent > 0 && `Spent ${money(totals.spent)}`,
                      totals.received > 0 && `Received ${money(totals.received)}`,
                      totals.moved > 0 && `Moved ${money(totals.moved)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
            </div>

            <section ref={listRef} aria-label="Transactions" className="min-w-0 scroll-mt-20">
              {shown.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No matches"
                  body="Nothing fits these filters. Try a wider date range or fewer filters."
                  action={
                    <button
                      type="button"
                      onClick={() => setView({ filters: NO_FILTERS, page: 1 })}
                      className="rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary"
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <>
                  <RowHint noun="transaction" actions="view, edit or delete" className="mb-1 px-1" />
                  {groups.map(({ day, list }, i) => (
                    <div key={`${day}-${i}`} className="mt-4 first:mt-2">
                      <h2 className="label-caps mb-2 px-1 text-on-surface-variant">{day}</h2>
                      <ul className="card divide-y divide-surface-container overflow-hidden px-5">
                        {list.map((x) =>
                          x.kind === "transfer" ? (
                            <TransferRow key={`tr-${x.item.id}`} t={x.item} />
                          ) : (
                            <TransactionRow key={x.item.id} t={x.item} />
                          ),
                        )}
                      </ul>
                    </div>
                  ))}
                  <Pagination page={current} pages={pages} onPage={goTo} />
                </>
              )}
            </section>
          </PageColumns>
        )}

        {pickingDates && (
          <DateRangeDialog
            from={filters.from}
            to={filters.to}
            onClose={() => {
              setPickingDates(false);
              // Cancelled without choosing any dates: nothing custom to keep.
              if (!filters.from && !filters.to) patch({ period: "any" });
            }}
            onDone={(from, to) => {
              setPickingDates(false);
              patch({ from, to });
            }}
          />
        )}
      </TabPage>
    </>
  );
}

function FilterSelect({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`relative block min-w-0 rounded-lg bg-surface-container-low px-3 py-2 ${disabled ? "opacity-50" : ""}`}>
      <span className="label-caps block text-on-surface-variant">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none truncate bg-transparent pr-5 text-sm outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 bottom-2.5 size-4 text-on-surface-variant" aria-hidden />
    </label>
  );
}
