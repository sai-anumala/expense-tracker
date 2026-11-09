"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SlidersHorizontal, CircleCheck, Plus, PieChart, Trash2, Pencil } from "lucide-react";
import { AmountForm } from "@/components/AmountForm";
import { SwipeActions } from "@/components/SwipeActions";
import { BalanceNotice } from "@/components/BalanceNotice";
import { availableBalance, budgetAboveBalance } from "@/lib/balance";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/store";
import { AppHeader, IconTile, MonthPill, PageColumns, ProgressBar, RowHint } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { EmptyState } from "@/components/TransactionRow";
import { pickableCategories, type CategoryId } from "@/lib/data";
import { MAX_CATEGORY_NAME, MAX_CUSTOM_CATEGORIES, normalizeCategoryName } from "@/lib/categoryRules";
import { useAppData } from "@/lib/store";
import { budgetLeftLevel, budgetStatus, periodBounds, spentByCategory, totalSpent, within } from "@/lib/insights";
import { daysLeftInMonth, money, moneySigned, monthLabel, plural } from "@/lib/format";

function status(ratio: number) {
  if (ratio > 1) return { warn: true, badge: "Over limit" };
  if (ratio >= 0.9) return { warn: true, badge: `${Math.round(ratio * 100)}% Spent` };
  if (ratio >= 0.8) return { warn: true, badge: "Near limit" };
  return { warn: false, badge: "On track" };
}

export default function Budgets() {
  const { transactions, transfers, budget, saveBudget, loans, settings, customCategories, categoryOf } = useAppData();
  const [editingLimit, setEditingLimit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CategoryId | null>(null);
  const [editingCat, setEditingCat] = useState<CategoryId | null>(null);
  const [busy, setBusy] = useState(false);

  const monthTx = within(transactions, periodBounds("month"));
  const spent = totalSpent(monthTx);
  const byCat = new Map(spentByCategory(monthTx).map((c) => [c.category, c.amount]));
  const limit = budget.monthlyLimit;
  const remaining = limit - spent;
  const daysLeft = daysLeftInMonth();
  const leftLevel = budgetLeftLevel(limit, spent);
  const leftColor = { ok: "text-primary", low: "text-tertiary", over: "text-secondary" }[leftLevel];
  // Low but below the "Watch spend" point: state the fact, since "On track" under an amber figure would read oddly.
  const leftNote =
    leftLevel === "low" && spent / limit < 0.85 ? `${Math.floor((remaining / limit) * 100)}% left` : budgetStatus(limit > 0 ? spent / limit : 0);
  // Informational checks (never block saving).
  // Walks every transaction, transfer and loan: recompute only when the data changes, not on every form change.
  const available = useMemo(() => availableBalance(transactions, transfers, loans, settings), [transactions, transfers, loans, settings]);
  const uncovered = budgetAboveBalance(limit, spent, available);
  const categoryTotal = budget.categories.reduce((s, c) => s + c.limit, 0);
  const categoriesAboveLimit = limit > 0 && categoryTotal > limit;
  const list = useViewAll(budget.categories);
  const choices: CategoryId[] = [...pickableCategories.filter((c) => c !== "other"), ...customCategories.map((c) => c.id), "other"];
  const unbudgeted = choices.filter((c) => !budget.categories.some((b) => b.category === c));
  const canCreate = customCategories.length < MAX_CUSTOM_CATEGORIES;

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await saveBudget({ ...budget, categories: budget.categories.filter((c) => c.category !== removing) });
      setRemoving(null);
    } catch (e) {
      setError(errorMessage(e, "Could not remove the category budget."));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader subtitle="Budgets" />
      <TabPage>
        <div className="flex items-center justify-between">
          <MonthPill label={monthLabel()} />
          <span className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-sm font-medium text-primary">
            <span className="size-2 rounded-full bg-primary" /> {plural(daysLeft, "day")} left
          </span>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
            {error}
          </p>
        )}

        <PageColumns>
          {/* Overall */}
          <section className="card min-w-0 bg-gradient-to-br from-primary-fixed/20 via-surface-container-lowest to-surface-container-lowest p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps text-on-surface-variant">Overall Monthly Budget</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  {limit > 0 ? money(limit) : "Not set"}{" "}
                  {limit > 0 && <span className="text-base font-normal text-on-surface-variant">limit</span>}
                </p>
              </div>
              {!editingLimit && (
                <button
                  onClick={() => setEditingLimit(true)}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-sm"
                >
                  <SlidersHorizontal className="size-4" aria-hidden /> Set Limit
                </button>
              )}
            </div>

            {editingLimit && (
              <AmountForm
                label="Monthly limit"
                initial={limit || undefined}
                onCancel={() => setEditingLimit(false)}
                onSave={async (v) => {
                  await saveBudget({ ...budget, monthlyLimit: v }); // errors are shown by AmountForm
                  setEditingLimit(false);
                }}
              />
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-container-low p-4">
              <div>
                <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="size-2 rounded-full bg-primary" /> Spent so far
                </p>
                <p className="mt-1 tabular-nums text-xl font-semibold">{money(spent)}</p>
                {limit > 0 && (
                  <p className="text-xs text-on-surface-variant">{((spent / limit) * 100).toFixed(1)}% utilized</p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="size-2 rounded-full bg-surface-dim" /> Remaining
                </p>
                <p className={`mt-1 tabular-nums text-xl font-semibold ${leftColor}`}>
                  {limit > 0 ? `${remaining < 0 ? "-" : ""}${money(remaining)}` : "—"}
                </p>
                {limit > 0 && (
                  <p className={`text-xs ${leftColor}`}>{leftNote}</p>
                )}
              </div>
            </div>
            {limit > 0 && (
              <>
                <div className="mt-5">
                  <ProgressBar value={spent / limit} tone={spent / limit < 0.9 ? "primary" : "tertiary"} />
                </div>
                {remaining > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-sm tabular-nums text-on-surface-variant">
                    <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
                    {money(remaining / daysLeft)} a day stays within budget
                  </p>
                )}
              </>
            )}
            {uncovered !== null && available !== null && (
              <div className="mt-4">
                <BalanceNotice tone="info">
                  You have <b className="tabular-nums">{money(uncovered)}</b> of budget left this month, but your available balance is{" "}
                  <b className="tabular-nums">{moneySigned(available)}</b>. To spend it all, you&apos;ll need more money coming in.
                </BalanceNotice>
              </div>
            )}
          </section>

          {/* Category budgets */}
          <section className="min-w-0">
            <div className="mb-3">
              <h2 className="text-[22px] font-semibold tracking-tight">Category Budgets</h2>
              <p className="text-sm text-on-surface-variant">
                {budget.categories.length
                  ? `${budget.categories.length} ${budget.categories.length === 1 ? "category" : "categories"} with limits`
                  : "Set limits for individual categories"}
              </p>
              {budget.categories.length > 0 && (
                <RowHint noun="budget" actions="edit or delete" />
              )}
              {categoriesAboveLimit && (
                <div className="mt-2">
                  <BalanceNotice tone="info">
                    Category budgets add up to <b className="tabular-nums">{money(categoryTotal)}</b>, which is more than your{" "}
                    <b className="tabular-nums">{money(limit)}</b> monthly budget.
                  </BalanceNotice>
                </div>
              )}
            </div>

            {budget.categories.length === 0 && !adding ? (
              <EmptyState
                icon={PieChart}
                title="No category budgets"
                body="Add a limit for a category to track it here."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start lg:grid-cols-1">
                {list.shown.map((b) => {
                  const cat = categoryOf(b.category);
                  const catSpent = byCat.get(b.category) ?? 0;
                  const ratio = catSpent / b.limit;
                  const s = status(ratio);
                  const left = b.limit - catSpent;
                  return (
                    <li key={b.category} className="card overflow-hidden p-0">
                      <SwipeActions
                        id={`budget-${b.category}`}
                        label={`${cat.long} budget, ${money(catSpent)} of ${money(b.limit)}`}
                        className="bg-surface-container-lowest p-4"
                        actions={[
                          { label: "Edit", icon: Pencil, tone: "primary", onClick: () => setEditingCat(b.category) },
                          { label: "Delete", icon: Trash2, tone: "danger", onClick: () => setRemoving(b.category) },
                        ]}
                      >
                        <div className="flex items-start gap-3">
                          <IconTile icon={cat.icon} tone={s.warn ? "tertiary" : "neutral"} round size="sm" />
                          <div className="min-w-0 flex-1">
                            {/* Row 1: name (truncates) · spent / limit (never wraps) */}
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="min-w-0 truncate font-semibold">{cat.long}</p>
                              <p className="shrink-0 whitespace-nowrap tabular-nums">
                                <span className="font-semibold">{money(catSpent)}</span>
                                <span className="text-xs text-on-surface-variant"> / {money(b.limit)}</span>
                              </p>
                            </div>
                            {/* Row 2: left/over · status badge (wraps on very narrow screens) */}
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                              <p
                                className={`text-sm tabular-nums ${s.warn ? "font-medium text-tertiary" : "text-on-surface-variant"}`}
                              >
                                {left >= 0 ? `${money(left)} left` : `${money(left)} over`}
                              </p>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  s.warn ? "bg-tertiary-fixed" : "bg-primary-fixed-dim/70"
                                }`}
                              >
                                <span className={`size-1.5 rounded-full ${s.warn ? "bg-tertiary" : "bg-primary"}`} />
                                {s.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <ProgressBar value={ratio} tone={s.warn ? "tertiary" : "primary"} />
                        </div>
                      </SwipeActions>
                      {editingCat === b.category && (
                        <div className="border-t border-surface-container px-4 pb-4">
                          <AmountForm
                            label={`${cat.long} limit`}
                            initial={b.limit}
                            allowZero={false}
                            onCancel={() => setEditingCat(null)}
                            onSave={async (v) => {
                              await saveBudget({
                                ...budget,
                                categories: budget.categories.map((c) => (c.category === b.category ? { ...c, limit: v } : c)),
                              });
                              setEditingCat(null);
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <ViewAllButton list={list} />

            {adding ? (
              <AddCategoryBudget
                options={unbudgeted}
                canCreate={canCreate}
                onCancel={() => setAdding(false)}
                onSave={async (category, v) => {
                  await saveBudget({ ...budget, categories: [...budget.categories, { category, limit: v }] });
                  list.setExpanded(true); // the new budget is last: keep it on screen
                  setAdding(false);
                }}
              />
            ) : (
              (unbudgeted.length > 0 || canCreate) && (
                <button
                  onClick={() => setAdding(true)}
                  className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-surface-container-low py-5 text-lg font-medium text-primary"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-primary-fixed-dim">
                    <Plus className="size-4" aria-hidden />
                  </span>
                  Create New Budget Category
                </button>
              )
            )}
            <p className="mt-3 text-center text-sm">
              <Link href="/categories" className="font-medium text-primary hover:underline">
                Manage your categories
              </Link>
            </p>
          </section>
        </PageColumns>

        <ConfirmDialog
          open={removing !== null}
          title={`Remove the ${removing ? categoryOf(removing).long : ""} budget?`}
          message="Your transactions stay. Only the spending limit for this category is removed."
          danger
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      </TabPage>
    </>
  );
}

function AddCategoryBudget({
  options,
  canCreate,
  onSave,
  onCancel,
}: {
  options: CategoryId[];
  canCreate: boolean;
  onSave: (c: CategoryId, v: number) => Promise<void>;
  onCancel: () => void;
}) {
  const { categoryOf, ensureCategory } = useAppData();
  const [category, setCategory] = useState<CategoryId | "new">(options[0] ?? "new");
  const [newName, setNewName] = useState("");
  const chip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${on ? "bg-primary text-on-primary" : "bg-surface-container"}`;

  async function save(v: number) {
    if (category !== "new") return onSave(category, v);
    const name = normalizeCategoryName(newName);
    if (!name) throw new Error("Enter a name for the new category.");
    await onSave(await ensureCategory(name), v);
  }

  return (
    <div className="card mt-4 p-4">
      <p className="label-caps mb-3 text-on-surface-variant">New category budget</p>
      <div className="flex flex-wrap gap-2">
        {options.map((id) => {
          const { label, icon: Icon } = categoryOf(id);
          return (
            <button key={id} aria-pressed={id === category} onClick={() => setCategory(id)} className={chip(id === category)}>
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          );
        })}
        {canCreate && (
          <button aria-pressed={category === "new"} onClick={() => setCategory("new")} className={chip(category === "new")}>
            <Plus className="size-4" aria-hidden /> New
          </button>
        )}
      </div>
      {category === "new" && (
        <label className="mt-3 block rounded-lg bg-surface-container-low px-4 py-3">
          <span className="label-caps block text-on-surface-variant">Category name</span>
          <input
            autoFocus
            value={newName}
            maxLength={MAX_CATEGORY_NAME}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Pet care"
            className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
          />
        </label>
      )}
      <AmountForm label="Category limit" allowZero={false} onCancel={onCancel} onSave={save} />
    </div>
  );
}
