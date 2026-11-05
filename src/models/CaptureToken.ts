import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "./defineModel";

/** A user's personal token for the Gmail script. One per user; the plain token is never stored. */
const CaptureTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    /** SHA-256 hex of the token. */
    tokenHash: { type: String, required: true, unique: true },
    /** Last time an alert arrived with this token, captured or not. */
    lastUsedAt: { type: Date },
  },
  { timestamps: true, strict: "throw" },
);

export type CaptureTokenDoc = InferSchemaType<typeof CaptureTokenSchema>;

export const CaptureTokenModel: Model<CaptureTokenDoc> = defineModel<CaptureTokenDoc>("CaptureToken", CaptureTokenSchema);
