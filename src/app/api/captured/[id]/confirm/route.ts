import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseTransactionInput, toTransactionDto } from "@/lib/transactionInput";
import { parseTransferInput, toTransferDto } from "@/lib/transferInput";
import { CapturedTransactionModel } from "@/models/CapturedTransaction";
import { TransactionModel } from "@/models/Transaction";
import { TransferModel } from "@/models/Transfer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = "This alert no longer exists.";
/** A claim older than this means the request that made it died; let the user try again. */
const STALE_CLAIM_MS = 60_000;

/**
 * POST /api/captured/:id/confirm — turn an alert into a transaction, or a transfer when `type` is "transfer".
 * The body is validated by the same parsers as the normal routes. Returns { transaction } or { transfer }.
 */
export async function POST(req: Request, { params }: Params) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const isTransfer = body.type === "transfer";
  const transfer = isTransfer ? parseTransferInput(body) : null;
  const transaction = isTransfer ? null : parseTransactionInput(body);
  if (transfer && !transfer.ok) return fail(400, transfer.error);
  if (transaction && !transaction.ok) return fail(400, transaction.error);

  let claimedId: unknown = null;
  try {
    await connectDb();
    const owned = { _id: id, userId: user.userId };
    const claim = await CapturedTransactionModel.findOneAndUpdate(
      {
        ...owned,
        $or: [{ status: "pending" }, { status: "confirming", updatedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } }],
      },
      { $set: { status: "confirming" } },
    ).lean();
    if (!claim) {
      const exists = await CapturedTransactionModel.exists(owned);
      return exists ? fail(409, "This alert is already being saved.") : fail(404, NOT_FOUND);
    }
    claimedId = claim._id;

    let payload: Record<string, unknown>;
    if (transfer?.ok) {
      const doc = await TransferModel.create({ ...transfer.value, userId: user.userId });
      payload = { transfer: toTransferDto(doc.toObject()) };
    } else if (transaction?.ok) {
      const doc = await TransactionModel.create({ ...transaction.value, userId: user.userId });
      payload = { transaction: toTransactionDto(doc.toObject()) };
    } else {
      throw new Error("Unreachable: input was validated above");
    }
    claimedId = null; // saved: a failure removing the alert must not report the save as failed
    await CapturedTransactionModel.deleteOne({ _id: claim._id }).catch((err) => console.error("captured.delete failed", err));
    return ok(payload, 201);
  } catch (err) {
    if (claimedId) {
      await CapturedTransactionModel.updateOne({ _id: claimedId }, { $set: { status: "pending" } }).catch(() => {});
    }
    return dbErrorResponse(err, "POST /api/captured/:id/confirm", "Failed to save this alert.");
  }
}
