import { MAX_RECEIPT_BYTES, MAX_RECEIPT_MB, RECEIPT_TOO_BIG, fitWithin, isImageType } from "./receipts";

/**
 * Gets a photo or PDF ready to upload (runs in the browser).
 * - PDF: sent as it is, but refused over the size limit.
 * - Photo: scaled down to at most 1600 px on its longest side and saved as a JPEG, lowering the quality until it
 *   fits. Phone photos are often several MB, and the limit for one upload is 4 MB. A browser that can open an
 *   iPhone HEIC photo converts it here too; one that can't says so instead of uploading something unreadable.
 */

const MAX_SIDE = 1600;
const QUALITIES = [0.85, 0.75, 0.62, 0.5];

export class ReceiptFileError extends Error {}

const CANT_READ = "Couldn't read that image. Try a JPEG, PNG or PDF.";

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to an <img> element, which some browsers decode more formats with
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ReceiptFileError(CANT_READ);
  }
}

export async function prepareReceipt(file: File): Promise<File> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > MAX_RECEIPT_BYTES) throw new ReceiptFileError(RECEIPT_TOO_BIG);
    return file;
  }
  if (!isImageType(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
    throw new ReceiptFileError("Only photos (JPEG, PNG, WebP) and PDF files can be attached.");

  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new ReceiptFileError(CANT_READ);
    const { width, height } = fitWithin(img.width, img.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ReceiptFileError(CANT_READ);
    ctx.fillStyle = "#ffffff"; // a transparent PNG would turn black as a JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.source, 0, 0, width, height);
    for (const q of QUALITIES) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= MAX_RECEIPT_BYTES) {
        const base = file.name.replace(/\.[^.]*$/, "") || "receipt";
        return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      }
    }
    throw new ReceiptFileError(`That photo is still over ${MAX_RECEIPT_MB} MB after shrinking. Try a smaller one.`);
  } finally {
    img.close();
  }
}
