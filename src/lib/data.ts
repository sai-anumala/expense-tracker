import {
  Utensils,
  ShoppingBasket,
  Car,
  ShoppingBag,
  Clapperboard,
  Zap,
  Heart,
  MoreHorizontal,
  Laptop,
  Banknote,
  type LucideIcon,
} from "lucide-react";

// Category definitions (app configuration, not data). Keep ids in sync with
// CATEGORY_IDS in src/models/Transaction.ts.
export type CategoryId =
  | "food"
  | "groceries"
  | "transport"
  | "shopping"
  | "fun"
  | "bills"
  | "health"
  | "other"
  | "hardware"
  | "income";

export type Tone = "neutral" | "primary" | "tertiary";

export const categories: Record<
  CategoryId,
  { label: string; long: string; icon: LucideIcon; tone: Tone; color: string }
> = {
  food: { label: "Food", long: "Food & Dining", icon: Utensils, tone: "neutral", color: "var(--color-primary)" },
  groceries: { label: "Groceries", long: "Groceries", icon: ShoppingBasket, tone: "primary", color: "var(--color-primary-fixed-dim)" },
  transport: { label: "Transport", long: "Transportation", icon: Car, tone: "neutral", color: "var(--color-tertiary)" },
  shopping: { label: "Shopping", long: "Shopping", icon: ShoppingBag, tone: "tertiary", color: "var(--color-secondary)" },
  fun: { label: "Fun & Subs", long: "Entertainment", icon: Clapperboard, tone: "tertiary", color: "var(--color-secondary-container)" },
  bills: { label: "Bills", long: "Utilities & Bills", icon: Zap, tone: "neutral", color: "var(--color-tertiary-fixed-dim)" },
  health: { label: "Health", long: "Health", icon: Heart, tone: "neutral", color: "var(--color-primary-container)" },
  other: { label: "Other", long: "Other", icon: MoreHorizontal, tone: "neutral", color: "var(--color-outline-variant)" },
  hardware: { label: "Hardware", long: "Hardware", icon: Laptop, tone: "neutral", color: "var(--color-outline)" },
  income: { label: "Income", long: "Income", icon: Banknote, tone: "primary", color: "var(--color-primary)" },
};

/** Expense categories selectable when adding a transaction or a budget. */
export const pickableCategories: CategoryId[] = [
  "food",
  "groceries",
  "transport",
  "shopping",
  "fun",
  "bills",
  "health",
  "other",
];

/** Payment methods offered on the Add screen. */
export const paymentMethods = ["Cash", "Debit Card", "Credit Card", "UPI", "Bank Transfer"];

export type Transaction = {
  id: string;
  merchant: string;
  category: CategoryId;
  /** Negative = expense, positive = income. */
  amount: number;
  date: string; // ISO
  account?: string;
};

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
};

export const emptySettings: Settings = { openingBalance: null, balanceAsOf: null };
