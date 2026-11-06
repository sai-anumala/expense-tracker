import "server-only";
import { createHash } from "node:crypto";
import { connectDb, ensureIndexes } from "./db";
import { fail } from "./api";
import { withDeadline } from "./deadline";
import { RateLimitModel } from "@/models/RateLimit";

/**
 * MongoDB-backed fixed-window rate limiting (works across stateless serverless instances).
 * Every helper fails OPEN: if the rate-limit step itself errors or takes longer than STEP_LIMIT_MS, it logs and
 * allows the request, so a counter problem never locks users out.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export type RateResult = { allowed: boolean; retryAfterSec: number };
const ALLOW: RateResult = { allowed: true, retryAfterSec: 0 };
/** Short enough that the three steps of a login still finish inside the route's own time limit. */
const STEP_LIMIT_MS = 3_000;

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
  await ensureIndexes(RateLimitModel); // builds the unique + TTL indexes once per process
}

/** Run a rate-limit step, giving `fallback` if it fails or stalls. A stalled step keeps running but nobody waits. */
function failOpen<T>(step: string, work: () => Promise<T>, fallback: T): Promise<T> {
  const guarded = work().catch((err) => {
    console.error(`rateLimit.${step} failed (allowing request)`, err);
    return fallback;
  });
  return withDeadline(guarded, STEP_LIMIT_MS, () => {
    console.error(`rateLimit.${step} timed out after ${STEP_LIMIT_MS} ms (allowing request)`);
    return fallback;
  });
}

/** Count one attempt. Starts a new window when the previous one has expired. */
export function hit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  return failOpen("hit", async () => {
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
  }, ALLOW);
}

/** Read-only check: blocked when `limit` attempts were already counted in the current window. */
export function check(key: string, limit: number): Promise<RateResult> {
  return failOpen("check", async () => {
    await ready();
    const now = Date.now();
    const doc = await RateLimitModel.findOne({ key }).lean();
    if (!doc || +doc.expiresAt <= now || doc.count < limit) return ALLOW;
    return { allowed: false, retryAfterSec: secondsLeft(doc.expiresAt, now) };
  }, ALLOW);
}

/** Forget a counter (e.g. failed logins after a successful one). */
export function clear(key: string): Promise<void> {
  return failOpen("clear", async () => {
    await ready();
    await RateLimitModel.deleteOne({ key });
  }, undefined);
}

/** 429 response with a Retry-After header (seconds). `what` e.g. "login attempts". */
export function tooMany(what: string, retryAfterSec: number) {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  const res = fail(429, `Too many ${what}. Try again in ${mins} ${mins === 1 ? "minute" : "minutes"}.`);
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
}
