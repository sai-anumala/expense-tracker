import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

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
  },
  { timestamps: true, strict: "throw" },
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const SettingsModel: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) || model<SettingsDoc>("Settings", SettingsSchema);
