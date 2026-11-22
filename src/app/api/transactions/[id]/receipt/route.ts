import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HOUR, hit, rateKey, tooMany } from "@/lib/rateLimit";
import { inlineDisposition, receiptKey, validateReceipt } from "@/lib/receiptInput";
import { deleteReceipt, readReceipt, receiptStorageConfigured, saveReceipt } from "@/lib/receiptStorage";
import { MAX_RECEIPT_BYTES, MAX_RECEIPTS_PER_USER, RECEIPT_TOO_BIG } from "@/lib/receipts";
import { toTransactionDto } from "@/lib/transactionInput";
import { TransactionModel } from "@/models/Transaction";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Same message for "doesn't exist" and "belongs to someone else", so IDs can't be probed.
const NOT_FOUND = "This transaction no longer exists. It may have been deleted.";
const NO_RECEIPT = "This transaction has no receipt.";
const NO_STORAGE = "Receipts aren't set up on this server yet.";
const STORAGE_FAILED = "Couldn't reach the receipt storage. Please try again.";

/** Uploads allowed per user per hour. */
const UPLOAD_LIMIT = 30;
/** A little room for the multipart envelope around a file of the maximum size. */
const BODY_OVERHEAD = 64 * 1024;

/** Common checks. Returns the user, the transaction id, or a response to send back. */
async function guard(params: Params["params"]) {
  const noDb = requireDb();
  if (noDb) return noDb;
  if (!receiptStorageConfigured()) return fail(503, NO_STORAGE);
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);
  return { user, id };
}

/** GET /api/transactions/:id/receipt: the file itself, for the signed-in owner only. */
export async function GET(_req: Request, { params }: Params) {
  const g = await guard(params);
  if (g instanceof NextResponse) return g;
  try {
    await connectDb();
    const doc = await TransactionModel.findOne({ _id: g.id, userId: g.user.userId }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    if (!doc.receipt) return fail(404, NO_RECEIPT);
    const file = await readReceipt(doc.receipt.key);
    if (!file) return fail(404, "The receipt file is missing.");
    return new Response(file.stream, {
      headers: {
        "Content-Type": doc.receipt.type,
        "Content-Length": String(doc.receipt.size),
        "Content-Disposition": inlineDisposition(doc.receipt.name),
        // Private data: never stored by a shared cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return dbErrorResponse(err, "GET /api/transactions/:id/receipt", "Failed to load the receipt.");
  }
}

/** POST /api/transactions/:id/receipt (multipart, field "file"): add or replace the receipt. */
export async function POST(req: Request, { params }: Params) {
  const g = await guard(params);
  if (g instanceof NextResponse) return g;

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RECEIPT_BYTES + BODY_OVERHEAD) return fail(413, RECEIPT_TOO_BIG);

  const limit = await hit(rateKey("receipt", g.user.userId), UPLOAD_LIMIT, HOUR);
  if (!limit.allowed) return tooMany("receipt uploads", limit.retryAfterSec);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Send the receipt as a file.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Send the receipt as a file.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateReceipt(bytes, file.name);
  if (!checked.ok) return fail(checked.status, checked.error);

  try {
    await connectDb();
    const doc = await TransactionModel.findOne({ _id: g.id, userId: g.user.userId }).lean();
    if (!doc) return fail(404, NOT_FOUND);
    if (!doc.receipt) {
      const stored = await TransactionModel.countDocuments({ userId: g.user.userId, "receipt.key": { $exists: true } });
      if (stored >= MAX_RECEIPTS_PER_USER)
        return fail(409, `You've reached the limit of ${MAX_RECEIPTS_PER_USER} receipts. Remove one to add another.`);
    }

    const { type, name, size } = checked.value;
    const key = receiptKey(g.user.userId, g.id, type, randomUUID());
    try {
      await saveReceipt(key, bytes, type);
    } catch (err) {
      console.error("POST /api/transactions/:id/receipt storage failed", err);
      return fail(502, STORAGE_FAILED);
    }

    const updated = await TransactionModel.findOneAndUpdate(
      { _id: g.id, userId: g.user.userId },
      { $set: { receipt: { key, name, type, size } } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      // The transaction was deleted while uploading: don't leave the file behind.
      await deleteReceipt(key).catch((e) => console.error("could not remove an orphaned receipt", e));
      return fail(404, NOT_FOUND);
    }
    if (doc.receipt?.key)
      await deleteReceipt(doc.receipt.key).catch((e) => console.error("could not remove the replaced receipt", e));
    return ok(toTransactionDto(updated));
  } catch (err) {
    return dbErrorResponse(err, "POST /api/transactions/:id/receipt", "Failed to save the receipt.");
  }
}

/** DELETE /api/transactions/:id/receipt: remove the receipt, keep the transaction. */
export async function DELETE(_req: Request, { params }: Params) {
  const g = await guard(params);
  if (g instanceof NextResponse) return g;
  try {
    await connectDb();
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: g.id, userId: g.user.userId },
      { $unset: { receipt: 1 } },
      { new: false },
    ).lean();
    if (!doc) return fail(404, NOT_FOUND);
    if (doc.receipt?.key)
      await deleteReceipt(doc.receipt.key).catch((e) => console.error("could not remove the receipt file", e));
    const { receipt: _removed, ...rest } = doc;
    void _removed;
    return ok(toTransactionDto(rest));
  } catch (err) {
    return dbErrorResponse(err, "DELETE /api/transactions/:id/receipt", "Failed to remove the receipt.");
  }
}
