import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CATEGORY_IDS } from "./Transaction";

const BudgetSchema = new Schema(
  {
    /** Owner's user id (one budget per user). */
    key: { type: String, required: true, unique: true },
    monthlyLimit: { type: Number, required: true, min: 0, default: 0 },
    categories: {
      type: [
        new Schema(
          {
            category: { type: String, required: true, enum: CATEGORY_IDS },
            limit: { type: Number, required: true, min: 0 },
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
  (models.Budget as Model<BudgetDoc>) || model<BudgetDoc>("Budget", BudgetSchema);
