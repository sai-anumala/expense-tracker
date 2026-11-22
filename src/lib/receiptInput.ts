import "server-only";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_BAD_TYPE,
  RECEIPT_TOO_BIG,
  type ReceiptType,
} from "./receipts";

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const EXTENSION: Record<ReceiptType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/**
 * What the file really is, from its first bytes. The browser's own file type and the file name are never
 * trusted: only these four formats are accepted, so SVG, HTML and scripts can't be stored and served back.
 */
export function sniffReceiptType(b: Uint8Array): ReceiptType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

const MAX_NAME = 200;

/**
 * A safe display name: no folders, control characters or quotes, at most 200 characters, and an extension
 * that matches the real type (a photo saved as "IMG_1.HEIC" and converted becomes "IMG_1.jpg").
 */
export function cleanFileName(raw: unknown, type: ReceiptType): string {
  const ext = EXTENSION[type];
  let base = typeof raw === "string" ? raw : "";
  base = base.split(/[\\/]/).pop() ?? "";
  base = base
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // ".pdf" is just an extension with no name.
  if (base.startsWith(".") && !base.slice(1).includes(".")) base = "";
  const dot = base.lastIndexOf(".");
  if (dot > 0) base = base.slice(0, dot);
  base = base.replace(/^\.+/, "").trim();
  if (!base) base = "receipt";
  return `${base.slice(0, MAX_NAME - ext.length - 1)}.${ext}`;
}

/** Check an uploaded file's bytes. 413 too big, 415 wrong kind of file, 400 empty. */
export function validateReceipt(
  bytes: Uint8Array,
  rawName: unknown,
): Result<{ type: ReceiptType; name: string; size: number }> {
  if (bytes.length === 0) return { ok: false, status: 400, error: "That file is empty." };
  if (bytes.length > MAX_RECEIPT_BYTES) return { ok: false, status: 413, error: RECEIPT_TOO_BIG };
  const type = sniffReceiptType(bytes);
  if (!type) return { ok: false, status: 415, error: RECEIPT_BAD_TYPE };
  return { ok: true, value: { type, name: cleanFileName(rawName, type), size: bytes.length } };
}

const OBJECT_ID = /^[a-f0-9]{24}$/;

/** Where a receipt lives in storage. The random part means a replacement is a new file, never a stale cached one. */
export function receiptKey(userId: string, transactionId: string, type: ReceiptType, token: string) {
  if (!OBJECT_ID.test(userId) || !OBJECT_ID.test(transactionId) || !/^[A-Za-z0-9-]{8,64}$/.test(token))
    throw new Error("Invalid receipt key parts.");
  return `receipts/${userId}/${transactionId}/${token}.${EXTENSION[type]}`;
}

/** The only shape of key storage will touch (defence in depth: a key never comes from the browser). */
export const RECEIPT_KEY_PATTERN = /^receipts\/[a-f0-9]{24}\/[a-f0-9]{24}\/[A-Za-z0-9-]{8,64}\.(jpg|png|webp|pdf)$/;

/** `Content-Disposition: inline` with an ASCII fallback and the real name in the RFC 5987 form. */
export function inlineDisposition(name: string) {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
