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
  bills: { label: "Bills", long: "Utilities & Bills", icon: Zap, tone: "neutral", color: "#ffb778" },
  health: { label: "Health", long: "Health", icon: Heart, tone: "neutral", color: "var(--color-primary-container)" },
  home: { label: "Sending home", long: "Sending home", icon: House, tone: "primary", color: "#3b6fb6" },
  fuel: { label: "Fuel", long: "Fuel", icon: Fuel, tone: "tertiary", color: "#b5651d" },
  friend: { label: "Sent to friend", long: "Sent to friend", icon: HandCoins, tone: "neutral", color: "#7a5cc7" },
  rent: { label: "Rent", long: "Rent", icon: Building2, tone: "neutral", color: "#4d7c0f" },
  education: { label: "Education", long: "Education", icon: GraduationCap, tone: "primary", color: "#0e7490" },
  gifts: { label: "Gifts", long: "Gifts & donations", icon: Gift, tone: "tertiary", color: "#be185d" },
  personal: { label: "Personal care", long: "Personal care", icon: Sparkles, tone: "neutral", color: "#a16207" },
  other: { label: "Other", long: "Other", icon: MoreHorizontal, tone: "neutral", color: "var(--color-outline-variant)" },
  hardware: { label: "Hardware", long: "Hardware", icon: Laptop, tone: "neutral", color: "var(--color-outline)" },
  income: { label: "Income", long: "Income", icon: Banknote, tone: "primary", color: "var(--color-primary)" },
};

/** Shown first on the Add screen (the 8th tile is "Show more"). */
export const primaryCategories: CategoryId[] = ["food", "groceries", "transport", "shopping", "fun", "bills", "health"];

/** Revealed by "Show more", ending with "Other". */
export const moreCategories: CategoryId[] = ["home", "fuel", "friend", "rent", "education", "gifts", "personal", "other"];

/** All expense categories selectable when adding a transaction or a budget. */
export const pickableCategories: CategoryId[] = [...primaryCategories, ...moreCategories];

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
