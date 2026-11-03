import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** The user's single credit card: statement/due day of month (1–28) and optional limit. */
const CardSchema = new Schema(
  {
    statementDay: { type: Number, required: true, min: 1, max: 28 },
    dueDay: { type: Number, required: true, min: 1, max: 28 },
    limit: { type: Number, min: 0.01 },
  },
  { _id: false, strict: "throw" },
);

const SettingsSchema = new Schema(
  {
    /** Owner's user id (one settings document per user). */
    key: { type: String, required: true, unique: true },
    /** Total available balance exactly as the user entered it; null = not set. */
    openingBalance: { type: Number, default: null, min: 0 },
    /**
     * When that balance was entered (truncated to the minute). Only transactions dated at or after
     * this moment change the balance. null on older docs → API falls back to `updatedAt`.
     */
    balanceAsOf: { type: Date, default: null },
    /** Unpaid credit card amount (billed + unbilled) entered with the balance, at `balanceAsOf`; null = never entered. */
    cardDueAtAnchor: { type: Number, default: null, min: 0 },
    /** Credit card setup; null = not set up. Saved separately (does not re-anchor the balance). */
    card: { type: CardSchema, default: null },
  },
  { timestamps: true, strict: "throw" },
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const SettingsModel: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) || model<SettingsDoc>("Settings", SettingsSchema);
