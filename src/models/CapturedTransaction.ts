import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "./defineModel";
import { CAPTURED_KINDS } from "@/lib/bankAlertParser";

/**
 * A bank alert waiting for review. Separate from transactions so it can't affect any total until confirmed.
 * Deleted on confirm or dismiss, and by MongoDB 30 days after arrival (TTL on expiresAt).
 */
const CapturedTransactionSchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this. */
    userId: { type: Types.ObjectId, ref: "User", required: true },
    /** Masked alert: no account/card/reference numbers or balances. */
    text: { type: String, required: true, maxlength: 1000 },
    sender: { type: String, trim: true, maxlength: 120 },
    receivedAt: { type: Date, required: true },
    /** Always positive; `kind` says which way the money went. */
    amount: { type: Number, required: true, min: 0.01 },
    kind: { type: String, required: true, enum: CAPTURED_KINDS },
    account: { type: String, maxlength: 80 },
    merchant: { type: String, maxlength: 120 },
    /** "confirming" = claimed by a confirm request, so a double tap can't create two records. */
    status: { type: String, required: true, enum: ["pending", "confirming"], default: "pending" },
    /** Hash of the Gmail message id. */
    dedupeKey: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

CapturedTransactionSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
CapturedTransactionSchema.index({ userId: 1, receivedAt: -1 });
CapturedTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CapturedTransactionDoc = InferSchemaType<typeof CapturedTransactionSchema>;

export const CapturedTransactionModel: Model<CapturedTransactionDoc> = defineModel<CapturedTransactionDoc>(
  "CapturedTransaction",
  CapturedTransactionSchema,
);
