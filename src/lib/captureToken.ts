import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** New personal token for the Gmail script. Shown to the user once; only its hash is stored. */
export const generateCaptureToken = () => `ldg_${randomBytes(32).toString("base64url")}`;

export const hashCaptureToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(ldg_[\w-]{20,200})$/i.exec(req.headers.get("authorization")?.trim() ?? "");
  return m ? m[1] : null;
}

/** Hash of the Gmail message id: the same email can't be queued twice when the script retries. */
export const captureDedupeKey = (messageId: string) => createHash("sha256").update(messageId).digest("hex");

type Lean = {
  _id: { toString(): string };
  text: string;
  sender?: string | null;
  receivedAt: Date;
  amount: number;
  kind: string;
  account?: string | null;
  merchant?: string | null;
};

export const toCapturedDto = (d: Lean) => ({
  id: d._id.toString(),
  text: d.text,
  sender: d.sender ?? undefined,
  receivedAt: new Date(d.receivedAt).toISOString(),
  amount: d.amount,
  kind: d.kind,
  account: d.account ?? undefined,
  merchant: d.merchant ?? undefined,
});
