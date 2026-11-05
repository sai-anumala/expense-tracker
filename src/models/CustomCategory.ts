import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { MAX_CATEGORY_NAME } from "@/lib/categoryRules";
import { defineModel } from "./defineModel";

const CustomCategorySchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this. */
    userId: { type: Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: MAX_CATEGORY_NAME },
    /** Lowercased name: one category per name per user, whatever the capitals. */
    nameKey: { type: String, required: true },
  },
  { timestamps: true, strict: "throw" },
);
CustomCategorySchema.index({ userId: 1, nameKey: 1 }, { unique: true });

export type CustomCategoryDoc = InferSchemaType<typeof CustomCategorySchema>;

export const CustomCategoryModel: Model<CustomCategoryDoc> =
  defineModel<CustomCategoryDoc>("CustomCategory", CustomCategorySchema);
