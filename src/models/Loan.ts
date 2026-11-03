import { Schema, Types, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "./defineModel";
import { LOAN_DIRECTIONS, LOAN_SOURCES } from "@/lib/loans";

const PaymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    account: { type: String, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true, timestamps: true, strict: "throw" },
);

const LoanSchema = new Schema(
  {
    /** Owner (User._id). Every query filters on this. */
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    /** "lent" = they owe me; "borrowed" = I owe them. */
    direction: { type: String, required: true, enum: LOAN_DIRECTIONS },
    person: { type: String, required: true, trim: true, maxlength: 60 },
    source: { type: String, required: true, enum: LOAN_SOURCES },
    /** Principal that changed hands on `date`. */
    amount: { type: Number, required: true, min: 0.01 },
    /** Total to be repaid (≥ amount; includes interest/fees). */
    totalDue: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    dueDate: { type: Date },
    monthlyPayment: { type: Number, min: 0.01 },
    paymentDay: { type: Number, min: 1, max: 28 },
    account: { type: String, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 200 },
    payments: { type: [PaymentSchema], default: [] },
  },
  { timestamps: true, strict: "throw" },
);

export type LoanDoc = InferSchemaType<typeof LoanSchema>;

export const LoanModel: Model<LoanDoc> = defineModel<LoanDoc>("Loan", LoanSchema);
