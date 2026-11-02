"use client";

import { useState } from "react";
import { SlidersHorizontal, CircleCheck, Plus, PieChart, Trash2, Pencil } from "lucide-react";
import { AmountForm } from "@/components/AmountForm";
import { SwipeActions } from "@/components/SwipeActions";
import { BalanceNotice } from "@/components/BalanceNotice";
import { availableBalance } from "@/lib/balance";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/store";
import { AppHeader, IconTile, MonthPill, ProgressBar } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState } from "@/components/TransactionRow";
import { categories, pickableCategories, type CategoryId } from "@/lib/data";
import { useAppData } from "@/lib/store";
import { periodBounds, spentByCategory, totalSpent, within } from "@/lib/insights";
import { daysLeftInMonth, money, moneySigned, monthLabel, plural } from "@/lib/format";

function status(ratio: number) {
  if (ratio > 1) return { warn: true, badge: "Over limit" };
  if (ratio >= 0.9) return { warn: true, badge: `${Math.round(ratio * 100)}% Spent` };
  if (ratio >= 0.8) return { warn: true, badge: "Near limit" };
  return { warn: false, badge: "On track" };
}

export default function Budgets() {
  const { transactions, budget, saveBudget, loans, settings } = useAppData();
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
  // Informational checks (never block saving).
  const available = availableBalance(transactions, loans, settings);
  const budgetAboveBalance = limit > 0 && available !== null && limit > available;
  const categoryTotal = budget.categories.reduce((s, c) => s + c.limit, 0);
  const categoriesAboveLimit = limit > 0 && categoryTotal > limit;
  const unbudgeted = pickableCategories.filter((c) => !budget.categories.some((b) => b.category === c));

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

        {/* Overall */}
        <section className="card bg-gradient-to-br from-primary-fixed/20 via-surface-container-lowest to-surface-container-lowest p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
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
              <p className={`mt-1 tabular-nums text-xl font-semibold ${remaining < 0 ? "text-secondary" : "text-primary"}`}>
                {limit > 0 ? `${remaining < 0 ? "-" : ""}${money(remaining)}` : "—"}
              </p>
              {limit > 0 && (
                <p className={`text-xs ${remaining < 0 ? "text-secondary" : "text-primary"}`}>
                  {remaining < 0 ? "Over budget" : "Safe pacing"}
                </p>
              )}
            </div>
          </div>
          {limit > 0 && (
            <>
              <div className="mt-5">
                <ProgressBar value={spent / limit} tone={spent / limit < 0.9 ? "primary" : "tertiary"} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <CircleCheck className="size-4 text-primary" aria-hidden />
                  {money(Math.max(0, remaining) / daysLeft)} safe daily budget
                </span>
                <span className="tabular-nums">{Math.round((spent / limit) * 100)}% Spent</span>
              </div>
            </>
          )}
          {budgetAboveBalance && available !== null && (
            <div className="mt-4">
              <BalanceNotice tone="info">
                Your monthly budget (<b className="tabular-nums">{money(limit)}</b>) is more than your available balance (
                <b className="tabular-nums">{moneySigned(available)}</b>). Make sure money is coming in before you spend it all.
              </BalanceNotice>
            </div>
          )}
        </section>

        {/* Category budgets */}
        <section>
          <div className="mb-3">
            <h2 className="text-[22px] font-semibold tracking-tight">Category Budgets</h2>
            <p className="text-sm text-on-surface-variant">
              {budget.categories.length
                ? `${budget.categories.length} ${budget.categories.length === 1 ? "category" : "categories"} with limits`
                : "Set limits for individual categories"}
            </p>
            {budget.categories.length > 0 && (
              <p className="text-xs text-on-surface-variant">Swipe a budget left (or tap it) to edit or delete.</p>
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
            <ul className="space-y-3">
              {budget.categories.map((b) => {
                const cat = categories[b.category];
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

          {adding ? (
            <AddCategoryBudget
              options={unbudgeted}
              onCancel={() => setAdding(false)}
              onSave={async (category, v) => {
                await saveBudget({ ...budget, categories: [...budget.categories, { category, limit: v }] });
                setAdding(false);
              }}
            />
          ) : (
            unbudgeted.length > 0 && (
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
        </section>
        <ConfirmDialog
          open={removing !== null}
          title={`Remove the ${removing ? categories[removing].long : ""} budget?`}
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
  onSave,
  onCancel,
}: {
  options: CategoryId[];
  onSave: (c: CategoryId, v: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<CategoryId>(options[0]);
  return (
    <div className="card mt-4 p-4">
      <p className="label-caps mb-3 text-on-surface-variant">New category budget</p>
      <div className="flex flex-wrap gap-2">
        {options.map((id) => {
          const { label, icon: Icon } = categories[id];
          return (
            <button
              key={id}
              aria-pressed={id === category}
              onClick={() => setCategory(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                id === category ? "bg-primary text-on-primary" : "bg-surface-container"
              }`}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          );
        })}
      </div>
      <AmountForm label="Category limit" allowZero={false} onCancel={onCancel} onSave={(v) => onSave(category, v)} />
    </div>
  );
}
