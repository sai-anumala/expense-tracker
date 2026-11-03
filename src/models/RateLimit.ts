import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Fixed-window counters for rate limiting (auth endpoints). Stored in MongoDB because Vercel
 * functions are stateless. `key` is a SHA-256 hash (never a raw email or IP).
 */
const RateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0, min: 0 },
    windowStart: { type: Date, required: true },
    /** End of the window. TTL index: MongoDB deletes the document shortly after this moment. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, strict: "throw" },
);

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof RateLimitSchema>;

export const RateLimitModel: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) || model<RateLimitDoc>("RateLimit", RateLimitSchema);
