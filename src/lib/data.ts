import {
  Utensils,
  ShoppingBasket,
  Car,
  ShoppingBag,
  Clapperboard,
  Zap,
  Heart,
  House,
  Fuel,
  HandCoins,
  Building2,
  GraduationCap,
  Gift,
  Sparkles,
  MoreHorizontal,
  Laptop,
  Banknote,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { categoryNameKey, type CustomCategoryId } from "./categoryRules";

// Category definitions (app configuration, not data). Keep ids in sync with
// CATEGORY_IDS in src/models/Transaction.ts. A user's own categories are `custom:<id>` (see categoryInfo).
export type BuiltInCategoryId =
  | "food"
  | "groceries"
  | "transport"
  | "shopping"
  | "fun"
  | "bills"
  | "health"
  | "home"
  | "fuel"
  | "friend"
  | "rent"
  | "education"
  | "gifts"
  | "personal"
  | "other"
  | "hardware"
  | "income";

export type CategoryId = BuiltInCategoryId | CustomCategoryId;

/** A category the user created; stored per user, see models/CustomCategory.ts. */
export type CustomCategory = { id: CustomCategoryId; name: string };

export type Tone = "neutral" | "primary" | "tertiary";

export type CategoryInfo = { label: string; long: string; icon: LucideIcon; tone: Tone };

export const categories: Record<BuiltInCategoryId, CategoryInfo> = {
  food: { label: "Food", long: "Food & Dining", icon: Utensils, tone: "neutral" },
  groceries: { label: "Groceries", long: "Groceries", icon: ShoppingBasket, tone: "primary" },
  transport: { label: "Transport", long: "Transportation", icon: Car, tone: "neutral" },
  shopping: { label: "Shopping", long: "Shopping", icon: ShoppingBag, tone: "tertiary" },
  fun: { label: "Fun & Subs", long: "Entertainment", icon: Clapperboard, tone: "tertiary" },
  bills: { label: "Bills", long: "Utilities & Bills", icon: Zap, tone: "neutral" },
  health: { label: "Health", long: "Health", icon: Heart, tone: "neutral" },
  home: { label: "Sending home", long: "Sending home", icon: House, tone: "primary" },
  fuel: { label: "Fuel", long: "Fuel", icon: Fuel, tone: "tertiary" },
  friend: { label: "Sent to friend", long: "Sent to friend", icon: HandCoins, tone: "neutral" },
  rent: { label: "Rent", long: "Rent", icon: Building2, tone: "neutral" },
  education: { label: "Education", long: "Education", icon: GraduationCap, tone: "primary" },
  gifts: { label: "Gifts", long: "Gifts & donations", icon: Gift, tone: "tertiary" },
  personal: { label: "Personal care", long: "Personal care", icon: Sparkles, tone: "neutral" },
  other: { label: "Other", long: "Other", icon: MoreHorizontal, tone: "neutral" },
  hardware: { label: "Hardware", long: "Hardware", icon: Laptop, tone: "neutral" },
  income: { label: "Income", long: "Income", icon: Banknote, tone: "primary" },
};

/** Shown first on the Add screen (the 8th tile is "Show more"). */
export const primaryCategories: CategoryId[] = ["food", "groceries", "transport", "shopping", "fun", "bills", "health"];

/** Revealed by "Show more", ending with "Other". */
export const moreCategories: CategoryId[] = ["home", "fuel", "friend", "rent", "education", "gifts", "personal", "other"];

/** All expense categories selectable when adding a transaction or a budget. */
export const pickableCategories: CategoryId[] = [...primaryCategories, ...moreCategories];

/** Built-in or custom. An id we don't recognise shows as Other rather than breaking the screen. */
export function categoryInfo(id: string, custom: CustomCategory[]): CategoryInfo {
  if (Object.hasOwn(categories, id)) return categories[id as BuiltInCategoryId];
  const mine = custom.find((c) => c.id === id);
  return mine
    ? { label: mine.name, long: mine.name, icon: Tag, tone: "neutral" }
    : categories.other;
}

/** The built-in category a typed name refers to ("rent", "Food & Dining"), so it isn't created twice. */
export function builtInCategoryByName(name: string): CategoryId | null {
  const key = categoryNameKey(name);
  return (
    pickableCategories.find((id) => {
      const c = categories[id as BuiltInCategoryId];
      return categoryNameKey(c.label) === key || categoryNameKey(c.long) === key;
    }) ?? null
  );
}

/** What a typed name would resolve to: a built-in or one of the user's own, or null when it would be new. */
export const existingCategoryByName = (name: string, custom: CustomCategory[]): CategoryId | null =>
  builtInCategoryByName(name) ?? custom.find((c) => categoryNameKey(c.name) === categoryNameKey(name))?.id ?? null;

/** Payment methods offered on the Add screen. */
export const paymentMethods = ["UPI", "Cash", "Debit Card", "Credit Card", "Bank Transfer"];

/** Pre-selected payment method for new transactions. */
export const DEFAULT_PAYMENT_METHOD = "UPI";

export type Transaction = {
  id: string;
  merchant: string;
  category: CategoryId;
  /** Negative = expense, positive = income. */
  amount: number;
  date: string; // ISO
  account?: string;
};

import type { CardSettings } from "./creditCard";

export type Budget = {
  /** Overall monthly spending limit; 0 = not set. */
  monthlyLimit: number;
  categories: { category: CategoryId; limit: number }[];
};

export const emptyBudget: Budget = { monthlyLimit: 0, categories: [] };

export type Settings = {
  /** Total available balance exactly as entered; null = not set yet. */
  openingBalance: number | null;
  /** ISO time the balance was entered; only transactions dated at/after it change the balance. */
  balanceAsOf: string | null;
  /** Unpaid credit card amount (billed + unbilled) entered together with the balance; null = not entered. */
  cardDueAtAnchor: number | null;
  /** The user's single credit card setup (statement/due day, optional limit); null = not set up. */
  card: CardSettings | null;
  /** Reminders the user removed; see Alert.dismissKey. */
  dismissedAlerts: string[];
};

export const emptySettings: Settings = { openingBalance: null, balanceAsOf: null, cardDueAtAnchor: null, card: null, dismissedAlerts: [] };
