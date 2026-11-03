import "server-only";
import { createHash } from "node:crypto";
import { connectDb } from "./db";
import { fail } from "./api";
import { RateLimitModel } from "@/models/RateLimit";

/**
 * MongoDB-backed fixed-window rate limiting (works across stateless serverless instances).
 * Every helper fails OPEN: if the rate-limit step itself errors, it logs and allows the request,
 * so a counter problem never locks users out.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export type RateResult = { allowed: boolean; retryAfterSec: number };
const ALLOW: RateResult = { allowed: true, retryAfterSec: 0 };

/** Hashed counter key, e.g. rateKey("login", email). No raw personal data is stored. */
export function rateKey(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

/** Client IP: first x-forwarded-for entry (set by Vercel), else x-real-ip, else "unknown". */
export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

const secondsLeft = (expiresAt: Date, now: number) => Math.max(1, Math.ceil((+expiresAt - now) / 1000));

async function ready() {
  await connectDb();
  await RateLimitModel.init(); // builds the unique + TTL indexes once (memoised by Mongoose)
}

/** Count one attempt. Starts a new window when the previous one has expired. */
export async function hit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  try {
    await ready();
    const now = new Date();
    const expired = { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now] };
    // Aggregation-pipeline update: atomic "reset if expired, else increment" in one round trip.
    const pipeline = [
      {
        $set: {
          count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
          windowStart: { $cond: [expired, now, "$windowStart"] },
          expiresAt: { $cond: [expired, new Date(+now + windowMs), "$expiresAt"] },
        },
      },
    ];
    const run = () =>
      RateLimitModel.collection.findOneAndUpdate({ key }, pipeline, { upsert: true, returnDocument: "after" });
    let doc;
    try {
      doc = await run();
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
      doc = await run(); // two concurrent upserts raced on the unique key; the retry updates the winner
    }
    if (!doc || doc.count <= limit) return ALLOW;
    return { allowed: false, retryAfterSec: secondsLeft(doc.expiresAt, +now) };
  } catch (err) {
    console.error("rateLimit.hit failed (allowing request)", err);
    return ALLOW;
  }
}

/** Read-only check: blocked when `limit` attempts were already counted in the current window. */
export async function check(key: string, limit: number): Promise<RateResult> {
  try {
    await ready();
    const now = Date.now();
    const doc = await RateLimitModel.findOne({ key }).lean();
    if (!doc || +doc.expiresAt <= now || doc.count < limit) return ALLOW;
    return { allowed: false, retryAfterSec: secondsLeft(doc.expiresAt, now) };
  } catch (err) {
    console.error("rateLimit.check failed (allowing request)", err);
    return ALLOW;
  }
}

/** Forget a counter (e.g. failed logins after a successful one). */
export async function clear(key: string) {
  try {
    await ready();
    await RateLimitModel.deleteOne({ key });
  } catch (err) {
    console.error("rateLimit.clear failed", err);
  }
}

/** 429 response with a Retry-After header (seconds). `what` e.g. "login attempts". */
export function tooMany(what: string, retryAfterSec: number) {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  const res = fail(429, `Too many ${what}. Try again in ${mins} ${mins === 1 ? "minute" : "minutes"}.`);
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
}
