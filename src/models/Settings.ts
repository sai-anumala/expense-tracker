import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SettingsSchema = new Schema(
  {
    /** Owner's user id (one settings document per user). */
    key: { type: String, required: true, unique: true },
    /** Money held when tracking started, exactly as entered; null = not set. */
    openingBalance: { type: Number, default: null, min: 0 },
  },
  { timestamps: true, strict: "throw" },
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const SettingsModel: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) || model<SettingsDoc>("Settings", SettingsSchema);
