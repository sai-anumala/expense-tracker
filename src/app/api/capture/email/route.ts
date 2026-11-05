import { NextResponse } from "next/server";
import { connectDb, ensureIndexes } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { alertText, parseBankAlert } from "@/lib/bankAlertParser";
import { bearerToken, captureDedupeKey, hashCaptureToken } from "@/lib/captureToken";
import { HOUR, MINUTE, check, clientIp, hit, rateKey, tooMany } from "@/lib/rateLimit";
import { CaptureTokenModel } from "@/models/CaptureToken";
import { CapturedTransactionModel } from "@/models/CapturedTransaction";

export const dynamic = "force-dynamic";

const MAX_TEXT = 5000;
const MAX_PENDING = 500;
const KEEP_MS = 30 * 24 * HOUR;
const BAD_TOKEN_LIMIT = 30;
const BAD_TOKEN_WINDOW = 15 * MINUTE;
const MESSAGE_LIMIT = 120;

/**
 * POST /api/capture/email — the user's Gmail script sends a bank alert. Public in the middleware because the script
 * has no session; authenticated here by the user's personal token. Ignored alerts are never stored and still return
 * 200, so the script moves on to the next one.
 */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;

  const ipKey = rateKey("capture-ip", clientIp(req));
  const blocked = await check(ipKey, BAD_TOKEN_LIMIT);
  if (!blocked.allowed) return tooMany("failed attempts", blocked.retryAfterSec);

  const token = bearerToken(req);
  try {
    await connectDb();
    const hash = token ? hashCaptureToken(token) : null;
    const owner = hash ? await CaptureTokenModel.findOne({ tokenHash: hash }).lean() : null;
    if (!hash || !owner) {
      await hit(ipKey, BAD_TOKEN_LIMIT, BAD_TOKEN_WINDOW);
      return fail(401, "Invalid or revoked capture token.");
    }

    const limit = await hit(rateKey("capture-token", hash), MESSAGE_LIMIT, HOUR);
    if (!limit.allowed) return tooMany("alerts", limit.retryAfterSec);

    const body = await readJsonObject(req);
    if (body instanceof NextResponse) return body;
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const text = typeof body.text === "string" ? body.text : "";
    if (!messageId || messageId.length > 200) return fail(400, "A message id is required.");
    if (!subject.trim() && !text.trim()) return fail(400, "Alert text is required.");
    if (subject.length + text.length > MAX_TEXT) return fail(400, "Alert is too long.");

    await CaptureTokenModel.updateOne({ _id: owner._id }, { $set: { lastUsedAt: new Date() } });

    const parsed = parseBankAlert(alertText(subject, text));
    if (!parsed.captured) return ok({ captured: false, reason: parsed.reason });

    const sent = new Date(String(body.receivedAt));
    const receivedAt = body.receivedAt == null || Number.isNaN(+sent) || +sent > Date.now() ? new Date() : sent;
    const sender = typeof body.sender === "string" && body.sender.trim() ? body.sender.trim().slice(0, 120) : undefined;

    const pending = await CapturedTransactionModel.countDocuments({ userId: owner.userId });
    if (pending >= MAX_PENDING) return ok({ captured: false, reason: "queue-full" });

    await ensureIndexes(CapturedTransactionModel); // the unique + TTL indexes
    try {
      await CapturedTransactionModel.create({
        userId: owner.userId,
        text: parsed.maskedText,
        sender,
        receivedAt,
        amount: parsed.amount,
        kind: parsed.kind,
        account: parsed.account,
        merchant: parsed.merchant,
        dedupeKey: captureDedupeKey(messageId),
        expiresAt: new Date(Date.now() + KEEP_MS),
      });
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) return ok({ captured: false, reason: "duplicate" });
      throw err;
    }
    return ok({ captured: true });
  } catch (err) {
    return dbErrorResponse(err, "POST /api/capture/email", "Failed to save the alert.");
  }
}
