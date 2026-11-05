"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { MAX_CATEGORY_NAME, MAX_CUSTOM_CATEGORIES, normalizeCategoryName } from "@/lib/categoryRules";
import { existingCategoryByName, moreCategories, primaryCategories, type CategoryId } from "@/lib/data";
import { useAppData } from "@/lib/store";

/**
 * Category tiles: the main ones, then "Show more" with the rest and the user's own, ending with Other.
 * Choosing Other opens a box to name a new category; it is only created when the form is saved (see `namedCategory`).
 */
export function CategoryPicker({
  value,
  onChange,
  newName,
  onNewName,
  compact = false,
}: {
  value: CategoryId | null;
  onChange: (c: CategoryId) => void;
  newName: string;
  onNewName: (name: string) => void;
  /** Smaller tiles, for use inside a card. */
  compact?: boolean;
}) {
  const { customCategories, categoryOf } = useAppData();
  const [showMore, setShowMore] = useState(() => value !== null && !primaryCategories.includes(value));

  const beforeOther = moreCategories.filter((c) => c !== "other");
  const tiles: CategoryId[] = showMore ? [...primaryCategories, ...beforeOther, ...customCategories.map((c) => c.id), "other"] : primaryCategories;
  const iconSize = compact ? "size-5" : "size-6";
  const tileBase = `flex aspect-square flex-col items-center justify-center rounded-xl px-1 text-center leading-tight transition sm:aspect-auto ${
    compact ? "gap-1 text-xs sm:py-3" : "gap-1.5 text-[13px] sm:py-4"
  }`;
  const idle = compact ? "bg-surface-container-low hover:bg-surface-container" : "card hover:bg-surface-container-low";

  const typed = normalizeCategoryName(newName);
  const existing = typed ? existingCategoryByName(typed, customCategories) : null;
  const atLimit = customCategories.length >= MAX_CUSTOM_CATEGORIES;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((id) => {
          const { label, icon: Icon } = categoryOf(id);
          const on = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(id)}
              className={`${tileBase} ${on ? "bg-primary text-on-primary" : idle}`}
            >
              <Icon className={`${iconSize} shrink-0`} aria-hidden />
              <span className="line-clamp-2 max-w-full break-words">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
          className={`${tileBase} border border-dashed border-outline-variant font-medium text-primary hover:bg-surface-container-low`}
        >
          {showMore ? <ChevronsUp className={iconSize} aria-hidden /> : <ChevronsDown className={iconSize} aria-hidden />}
          {showMore ? "Show less" : "Show more"}
        </button>
      </div>

      {value === "other" &&
        (atLimit ? (
          <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            You have {MAX_CUSTOM_CATEGORIES} of your own categories, the most you can have.{" "}
            <Link href="/categories" className="font-medium text-primary underline underline-offset-2">
              Manage categories
            </Link>
          </p>
        ) : (
          <label className="block rounded-lg bg-surface-container-low px-4 py-3">
            <span className="label-caps block text-on-surface-variant">Name this category (optional)</span>
            <input
              value={newName}
              maxLength={MAX_CATEGORY_NAME}
              onChange={(e) => onNewName(e.target.value)}
              placeholder="e.g. Pet care"
              className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
            />
            <span className="mt-1 block text-xs text-on-surface-variant">
              {existing
                ? `You already have this one. It'll be saved under ${categoryOf(existing).long}.`
                : "It'll be there next time, and you can set a budget for it. Leave blank to save as Other."}
            </span>
          </label>
        ))}
    </div>
  );
}

/** The category to save with: a typed name is only used when Other is still the selected tile. */
export const namedCategory = (category: CategoryId | null, newName: string) =>
  category === "other" && normalizeCategoryName(newName) ? normalizeCategoryName(newName) : null;
