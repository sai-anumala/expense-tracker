import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "./defineModel";
import { isCategoryId } from "./Transaction";

const CategoryLimitSchema = new Schema(
  {
    category: { type: String, required: true, validate: { validator: isCategoryId, message: "Unknown category." } },
    limit: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const BudgetSchema = new Schema(
  {
    /** Owner's user id (one budget per user). */
    key: { type: String, required: true, unique: true },
    monthlyLimit: { type: Number, required: true, min: 0, default: 0 },
    categories: { type: [CategoryLimitSchema], default: [] },
    /** The budget as last saved in each month, oldest first (see lib/budgetHistory.ts). */
    history: {
      type: [
        new Schema(
          {
            month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
            monthlyLimit: { type: Number, required: true, min: 0 },
            categories: { type: [CategoryLimitSchema], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, strict: "throw" },
);

export type BudgetDoc = InferSchemaType<typeof BudgetSchema>;

export const BudgetModel: Model<BudgetDoc> =
  defineModel<BudgetDoc>("Budget", BudgetSchema);
