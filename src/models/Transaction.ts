import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { isCustomCategoryId } from "@/lib/categoryRules";
import { defineModel } from "./defineModel";

export const CATEGORY_IDS = [
  "food",
  "groceries",
  "transport",
  "shopping",
  "fun",
  "bills",
  "health",
  "home",
  "fuel",
  "friend",
  "rent",
  "education",
  "gifts",
  "personal",
  "other",
  "hardware",
  "income",
] as const;

/** A built-in category id or a user's own (`custom:<id>`). Routes also check a custom id belongs to the user. */
export const isCategoryId = (v: unknown) =>
  CATEGORY_IDS.includes(v as (typeof CATEGORY_IDS)[number]) || isCustomCategoryId(v);

const TransactionSchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this so users only see their own data. */
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, validate: { validator: isCategoryId, message: "Unknown category." } },
    /** Negative = expense, positive = income. */
    amount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    account: { type: String, trim: true, maxlength: 80 },
    /** Legacy: older versions stored only a file name (no file). Never written now; kept so old documents still load. */
    receiptName: { type: String, trim: true, maxlength: 200 },
    /** The uploaded receipt (a private file in Vercel Blob). `key` is where it lives and is never sent to the browser. */
    receipt: {
      type: new Schema(
        {
          key: { type: String, required: true, maxlength: 200 },
          name: { type: String, required: true, maxlength: 200 },
          type: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
          size: { type: Number, required: true, min: 1 },
        },
        { _id: false },
      ),
    },
  },
  { timestamps: true, strict: "throw" },
);

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;

export const TransactionModel: Model<TransactionDoc> =
  defineModel<TransactionDoc>("Transaction", TransactionSchema);
