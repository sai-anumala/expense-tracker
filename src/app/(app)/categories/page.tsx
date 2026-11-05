"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/TransactionRow";
import { IconTile, SubHeader } from "@/components/ui";
import { ViewAllButton, useViewAll } from "@/components/ViewAll";
import { MAX_CATEGORY_NAME, MAX_CUSTOM_CATEGORIES, normalizeCategoryName } from "@/lib/categoryRules";
import { existingCategoryByName, type CustomCategory } from "@/lib/data";
import { money, plural } from "@/lib/format";
import { errorMessage, useAppData } from "@/lib/store";

/** The user's own categories: add, rename, delete. Deleting moves its expenses to Other. */
export default function ManageCategories() {
  const { customCategories, categoryOf, ensureCategory, renameCategory, deleteCategory, transactions, budget } = useAppData();
  const list = useViewAll(customCategories);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmRename, setConfirmRename] = useState(false);
  const [deleting, setDeleting] = useState<CustomCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const expenseCount = (id: string) => transactions.filter((t) => t.category === id).length;
  const budgetOf = (id: string) => budget.categories.find((c) => c.category === id);
  const atLimit = customCategories.length >= MAX_CUSTOM_CATEGORIES;

  async function run(action: () => Promise<void>, failMsg: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e, failMsg));
    } finally {
      setBusy(false);
      setConfirmRename(false);
      setDeleting(null);
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeCategoryName(name);
    if (!clean || busy) return;
    const existing = existingCategoryByName(clean, customCategories);
    if (existing) {
      setNotice(`You already have ${categoryOf(existing).long}.`);
      setError(null);
      return;
    }
    run(async () => {
      await ensureCategory(clean);
      setName("");
      list.setExpanded(true); // the new one may sort past the first few: keep it on screen
    }, "Could not add the category.");
  }

  const editedName = editing ? normalizeCategoryName(editing.name) : "";
  const editingCategory = customCategories.find((c) => c.id === editing?.id);

  return (
    <div className="pb-10">
      <SubHeader title="Your categories" backHref="/budgets" backLabel="Back to budgets" />
      <main className="mx-auto w-full max-w-xl space-y-4 px-5 pt-2 md:px-0">
        <p className="px-1 text-sm text-on-surface-variant">
          Categories you add appear when you add an expense, review a bank alert or set a budget. You can have up to{" "}
          {MAX_CUSTOM_CATEGORIES}.
        </p>

        {!atLimit && (
          <form onSubmit={add} className="card flex items-center gap-2 p-3">
            <input
              aria-label="New category name"
              value={name}
              maxLength={MAX_CATEGORY_NAME}
              onChange={(e) => setName(e.target.value)}
              placeholder="New category, e.g. Pet care"
              className="min-w-0 flex-1 rounded-lg bg-surface-container-low px-4 py-3 outline-none placeholder:text-outline"
            />
            <button
              disabled={busy || !normalizeCategoryName(name)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-3 font-medium text-on-primary disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden /> Add
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {notice}
          </p>
        )}

        {customCategories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No categories of your own yet"
            body="Add one here, or choose Other when adding an expense and give it a name."
          />
        ) : (
          <>
            <ul className="card divide-y divide-surface-container overflow-hidden">
              {list.shown.map((c) => {
                const count = expenseCount(c.id);
                const limit = budgetOf(c.id)?.limit;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <IconTile icon={Tag} size="sm" round />
                    {editing?.id === c.id ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editedName && editedName !== c.name) setConfirmRename(true);
                        }}
                      >
                        <input
                          aria-label={`New name for ${c.name}`}
                          autoFocus
                          value={editing.name}
                          maxLength={MAX_CATEGORY_NAME}
                          onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg bg-surface-container-low px-3 py-2 outline-none"
                        />
                        <button
                          aria-label="Save name"
                          disabled={!editedName || editedName === c.name}
                          className="rounded-full p-2 text-primary hover:bg-surface-container disabled:opacity-40"
                        >
                          <Check className="size-5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel renaming"
                          onClick={() => setEditing(null)}
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                        >
                          <X className="size-5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="truncate text-xs tabular-nums text-on-surface-variant">
                            {plural(count, "expense")}
                            {limit !== undefined && ` · ${money(limit)} budget`}
                          </p>
                        </div>
                        <button
                          aria-label={`Rename ${c.name}`}
                          onClick={() => {
                            setError(null);
                            setEditing({ id: c.id, name: c.name });
                          }}
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          aria-label={`Delete ${c.name}`}
                          onClick={() => {
                            setError(null);
                            setDeleting(c);
                          }}
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <ViewAllButton list={list} />
          </>
        )}

        <ConfirmDialog
          open={confirmRename}
          title={`Rename "${editingCategory?.name ?? ""}"?`}
          message={
            <>
              It will become <b className="text-on-surface">{editedName}</b> on its expenses and budget. Notes you already saved don&apos;t change.
            </>
          }
          confirmLabel="Yes, rename"
          busy={busy}
          onCancel={() => setConfirmRename(false)}
          onConfirm={() => {
            if (!editing) return;
            run(async () => {
              await renameCategory(editing.id, editedName);
              setEditing(null);
            }, "Could not rename the category.");
          }}
        />
        <ConfirmDialog
          open={deleting !== null}
          title={`Delete "${deleting?.name ?? ""}"?`}
          message={
            deleting && (
              <>
                {expenseCount(deleting.id) > 0
                  ? `Its ${plural(expenseCount(deleting.id), "expense")} will move to Other. `
                  : "No expenses use it. "}
                {budgetOf(deleting.id) ? "Its budget will be removed. " : ""}
                Your amounts and totals stay the same.
              </>
            )
          }
          confirmLabel="Yes, delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const target = deleting;
            if (target) run(() => deleteCategory(target.id), "Could not delete the category.");
          }}
        />
      </main>
    </div>
  );
}
