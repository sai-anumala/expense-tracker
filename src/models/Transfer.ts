import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "./defineModel";
import { TRANSFER_ACCOUNTS } from "@/lib/transfers";

/** Money moved between the user's own accounts. Never income/spending; never changes the balance. */
const TransferSchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this. */
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    from: { type: String, required: true, enum: TRANSFER_ACCOUNTS },
    to: { type: String, required: true, enum: TRANSFER_ACCOUNTS },
    /** Always positive. */
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true, strict: "throw" },
);

export type TransferDoc = InferSchemaType<typeof TransferSchema>;

export const TransferModel: Model<TransferDoc> =
  defineModel<TransferDoc>("Transfer", TransferSchema);
