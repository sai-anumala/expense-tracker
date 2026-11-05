// Rules for the categories a user creates. No UI or server imports: used by models, API routes and screens.

export const MAX_CUSTOM_CATEGORIES = 20;
export const MAX_CATEGORY_NAME = 30;

export type CustomCategoryId = `custom:${string}`;

const CUSTOM_ID = /^custom:[0-9a-f]{24}$/;
export const isCustomCategoryId = (v: unknown): v is CustomCategoryId => typeof v === "string" && CUSTOM_ID.test(v);

/** Trims, collapses inner spaces. What the user sees. */
export const normalizeCategoryName = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ");

/** Compared to spot duplicates: "Pet care", "pet  CARE " and "PET CARE" are one category. */
export const categoryNameKey = (name: string) => normalizeCategoryName(name).toLowerCase();

export function validateCategoryName(name: unknown): { ok: true; name: string; key: string } | { ok: false; error: string } {
  const clean = typeof name === "string" ? normalizeCategoryName(name) : "";
  if (!clean) return { ok: false, error: "Enter a name for the category." };
  if (clean.length > MAX_CATEGORY_NAME) return { ok: false, error: `Category names can be up to ${MAX_CATEGORY_NAME} characters.` };
  if (!/[\p{L}\p{N}]/u.test(clean)) return { ok: false, error: "Category names need at least one letter or number." };
  const key = categoryNameKey(clean);
  if (key === "income") return { ok: false, error: "Income can't be an expense category." };
  return { ok: true, name: clean, key };
}
