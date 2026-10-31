import "server-only";
import { NextResponse } from "next/server";
import { isDbConfigured } from "./db";

/** Largest amount accepted anywhere (₹1,000 crore) — guards against typos and overflow. */
export const MAX_AMOUNT = 10_000_000_000;

/** Round to paise. */
export const toPaise = (n: number) => Math.round(n * 100) / 100;

export const ok = (payload: unknown, status = 200) => NextResponse.json({ success: true, payload }, { status });

export const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

/** 503 response if MONGODB_URI is missing, otherwise null. */
export function requireDb() {
  return isDbConfigured() ? null : fail(503, "Database not configured. Set MONGODB_URI in .env.local.");
}

/** Parse a JSON object body. Returns the object, or a 400 response for bad/non-object JSON. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

/**
 * Map an error thrown while talking to MongoDB to an HTTP response.
 * Logs the full error server-side; returns only safe, actionable text to the client.
 */
export function dbErrorResponse(err: unknown, context: string, fallback: string) {
  console.error(context, err);
  const e = err as { name?: string; code?: number; message?: string; errors?: Record<string, { message?: string }> };
  const msg = e?.message ?? "";

  if (e?.name === "ValidationError") {
    const first = e.errors && Object.values(e.errors)[0]?.message;
    return fail(400, first ? `Invalid data: ${first}` : "Invalid data.");
  }
  if (e?.name === "CastError") return fail(400, "Invalid value in request.");
  if (e?.name === "StrictModeError") return fail(400, "Request contains unknown fields.");
  if (e?.code === 11000) return fail(409, "That record was changed at the same time. Please try again.");
  if (/auth/i.test(msg)) return fail(503, "Database authentication failed. Check the username/password in MONGODB_URI.");
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|timed out|Server selection|MongoNetworkError|not connected/i.test(msg) || e?.name === "MongoNetworkError")
    return fail(503, "Can't connect to MongoDB right now. Check your connection and Atlas Network Access, then try again.");
  return fail(500, fallback);
}
