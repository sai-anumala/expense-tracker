import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";

export const CATEGORY_IDS = [
  "food",
  "groceries",
  "transport",
  "shopping",
  "fun",
  "bills",
  "health",
  "other",
  "hardware",
  "income",
] as const;

const TransactionSchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this so users only see their own data. */
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: CATEGORY_IDS },
    /** Negative = expense, positive = income. */
    amount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    account: { type: String, trim: true, maxlength: 80 },
    /** Only when category is "other": preset (e.g. "Fuel") or user-typed label. */
    subcategory: { type: String, trim: true, maxlength: 40 },
    receiptName: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true, strict: "throw" },
);

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;

export const TransactionModel: Model<TransactionDoc> =
  (models.Transaction as Model<TransactionDoc>) || model<TransactionDoc>("Transaction", TransactionSchema);
