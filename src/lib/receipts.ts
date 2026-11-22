/** Receipts (one photo or PDF per transaction): limits and small helpers shared by the browser and the server. */

/** Vercel rejects request bodies over 4.5 MB, so a receipt must stay under this to fit in one upload. */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const MAX_RECEIPT_MB = 4;
/** Receipts one user can store, so open sign-up can't fill the storage. Replacing a receipt doesn't count twice. */
export const MAX_RECEIPTS_PER_USER = 300;

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

/** The file picker accepts any image (the browser shrinks it to a JPEG first) and PDFs. */
export const RECEIPT_ACCEPT = "image/*,application/pdf";

export const RECEIPT_TOO_BIG = `That file is over ${MAX_RECEIPT_MB} MB. Use a smaller photo or PDF.`;
export const RECEIPT_BAD_TYPE = "Only photos (JPEG, PNG, WebP) and PDF files can be attached.";

export const isImageType = (type: string) => type.startsWith("image/");

/** "850 B", "340 KB", "2.4 MB". */
export function formatBytes(n: number) {
  if (!(n >= 0)) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Size an image to fit with its longest side at most `max` px, keeping the shape. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > max)) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
