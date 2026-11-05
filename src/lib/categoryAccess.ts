import "server-only";
import { CustomCategoryModel } from "@/models/CustomCategory";
import { isCustomCategoryId, type CustomCategoryId } from "./categoryRules";

export const MISSING_CATEGORY = "That category no longer exists. Please pick another.";

export const customCategoryId = (id: { toString(): string }): CustomCategoryId => `custom:${id.toString()}`;

type Lean = { _id: { toString(): string }; name: string };
export const toCustomCategoryDto = (d: Lean) => ({ id: customCategoryId(d._id), name: d.name });

/** True when every custom id is this user's own; built-in categories always pass. Call after connectDb(). */
export async function ownsCategories(userId: string, categories: string[]) {
  const ids = [...new Set(categories.filter(isCustomCategoryId))].map((c) => c.slice("custom:".length));
  if (ids.length === 0) return true;
  return (await CustomCategoryModel.countDocuments({ userId, _id: { $in: ids } })) === ids.length;
}
