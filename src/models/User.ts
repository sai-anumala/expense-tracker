import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    /** bcrypt hash — never returned by default. */
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true, strict: "throw" },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const UserModel: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);
