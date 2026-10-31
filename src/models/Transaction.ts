import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

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
    merchant: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: CATEGORY_IDS },
    /** Negative = expense, positive = income. */
    amount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    account: { type: String, trim: true, maxlength: 80 },
    receiptName: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true, strict: "throw" },
);

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;

export const TransactionModel: Model<TransactionDoc> =
  (models.Transaction as Model<TransactionDoc>) || model<TransactionDoc>("Transaction", TransactionSchema);
