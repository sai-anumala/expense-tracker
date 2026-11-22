import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { del, get, put } from "@vercel/blob";
import { RECEIPT_KEY_PATTERN } from "./receiptInput";

/**
 * Where receipt files live. Production: a private Vercel Blob store (short-lived Vercel credentials, so no
 * secret is stored by the app). The only way to a file is through the receipt routes, which check the owner.
 *
 * For testing without Vercel credentials, a directory on disk is used instead, but only when
 * RECEIPTS_LOCAL_DIR is set AND the code is not running on Vercel, so it can never be active there.
 */

const localDir = () => (process.env.RECEIPTS_LOCAL_DIR && !process.env.VERCEL ? process.env.RECEIPTS_LOCAL_DIR : null);

/** Is there somewhere to put receipts? Routes answer 503 when not (like a missing database). */
export function receiptStorageConfigured() {
  return Boolean(localDir() || process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

function assertKey(key: string) {
  if (!RECEIPT_KEY_PATTERN.test(key)) throw new Error("Invalid receipt key.");
}

export async function saveReceipt(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  assertKey(key);
  const dir = localDir();
  if (dir) {
    const file = join(dir, key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return;
  }
  await put(key, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
}

/** The file's bytes as a stream, or null when it isn't there. */
export async function readReceipt(key: string): Promise<{ stream: ReadableStream<Uint8Array> } | null> {
  assertKey(key);
  const dir = localDir();
  if (dir) {
    const file = join(dir, key);
    return new Promise((resolve, reject) => {
      const s = createReadStream(file);
      s.once("error", (e) => ((e as NodeJS.ErrnoException).code === "ENOENT" ? resolve(null) : reject(e)));
      s.once("open", () => resolve({ stream: Readable.toWeb(s) as ReadableStream<Uint8Array> }));
    });
  }
  const res = await get(key, { access: "private", useCache: false });
  return res && res.statusCode === 200 ? { stream: res.stream } : null;
}

export async function deleteReceipt(key: string): Promise<void> {
  assertKey(key);
  const dir = localDir();
  if (dir) {
    await rm(join(dir, key), { force: true });
    return;
  }
  await del(key);
}
