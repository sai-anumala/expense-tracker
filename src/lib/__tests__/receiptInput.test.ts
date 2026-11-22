import { describe, expect, it } from "vitest";
import {
  RECEIPT_KEY_PATTERN,
  cleanFileName,
  inlineDisposition,
  receiptKey,
  sniffReceiptType,
  validateReceipt,
} from "../receiptInput";
import { MAX_RECEIPT_BYTES, RECEIPT_BAD_TYPE, RECEIPT_TOO_BIG, fitWithin, formatBytes, isImageType } from "../receipts";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = new Uint8Array([...text("RIFF"), 1, 2, 3, 4, ...text("WEBP"), 0]);
const PDF = text("%PDF-1.7\n%...");

describe("sniffReceiptType", () => {
  it("recognises the four allowed formats by their first bytes", () => {
    expect(sniffReceiptType(JPEG)).toBe("image/jpeg");
    expect(sniffReceiptType(PNG)).toBe("image/png");
    expect(sniffReceiptType(WEBP)).toBe("image/webp");
    expect(sniffReceiptType(PDF)).toBe("application/pdf");
  });
  it("rejects HTML, SVG, scripts, executables and text, whatever they are called", () => {
    expect(sniffReceiptType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffReceiptType(text('<?xml version="1.0"?><svg onload="x()"/>'))).toBeNull();
    expect(sniffReceiptType(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffReceiptType(bytes(0x4d, 0x5a, 0x90, 0))).toBeNull(); // Windows executable
    expect(sniffReceiptType(text("just some text"))).toBeNull();
    expect(sniffReceiptType(text("GIF89a"))).toBeNull(); // not on the allowlist
  });
  it("needs enough bytes and the whole signature", () => {
    expect(sniffReceiptType(new Uint8Array())).toBeNull();
    expect(sniffReceiptType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffReceiptType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(sniffReceiptType(new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]))).toBeNull(); // RIFF but not WebP
    expect(sniffReceiptType(text("%PDF"))).toBeNull();
  });
});

describe("validateReceipt", () => {
  it("accepts a good file and returns its real type, a clean name and its size", () => {
    expect(validateReceipt(JPEG, "Lunch bill.JPG")).toEqual({ ok: true, value: { type: "image/jpeg", name: "Lunch bill.jpg", size: JPEG.length } });
  });
  it("says an empty file is empty (400)", () => {
    expect(validateReceipt(new Uint8Array(), "a.jpg")).toEqual({ ok: false, status: 400, error: "That file is empty." });
  });
  it("refuses a file over 4 MB (413) but allows exactly 4 MB", () => {
    const exactly = new Uint8Array(MAX_RECEIPT_BYTES);
    exactly.set(PDF);
    expect(validateReceipt(exactly, "big.pdf").ok).toBe(true);
    const over = new Uint8Array(MAX_RECEIPT_BYTES + 1);
    over.set(PDF);
    expect(validateReceipt(over, "big.pdf")).toEqual({ ok: false, status: 413, error: RECEIPT_TOO_BIG });
  });
  it("refuses HTML that is named like a PDF or a photo (415)", () => {
    const html = text("<html><body>hi</body></html>");
    expect(validateReceipt(html, "receipt.pdf")).toEqual({ ok: false, status: 415, error: RECEIPT_BAD_TYPE });
    expect(validateReceipt(html, "receipt.jpg")).toMatchObject({ ok: false, status: 415 });
  });
  it("trusts the bytes, not the name: a PNG called .pdf is stored as a png", () => {
    expect(validateReceipt(PNG, "scan.pdf")).toMatchObject({ ok: true, value: { type: "image/png", name: "scan.png" } });
  });
});

describe("cleanFileName", () => {
  it("drops folders, control characters and quote-like characters", () => {
    expect(cleanFileName("../../etc/passwd.jpg", "image/jpeg")).toBe("passwd.jpg");
    expect(cleanFileName("C:\\Users\\me\\bill.pdf", "application/pdf")).toBe("bill.pdf");
    expect(cleanFileName('a"b<c>d|e?f*g.png', "image/png")).toBe("abcdefg.png");
    expect(cleanFileName("line\nbreak\u0000.jpg", "image/jpeg")).toBe("linebreak.jpg");
  });
  it("fixes the extension to match the real type", () => {
    expect(cleanFileName("IMG_0042.HEIC", "image/jpeg")).toBe("IMG_0042.jpg");
    expect(cleanFileName("photo.jpeg", "image/jpeg")).toBe("photo.jpg");
    expect(cleanFileName("noextension", "application/pdf")).toBe("noextension.pdf");
  });
  it("falls back to 'receipt' for empty or odd input", () => {
    for (const raw of ["", "   ", ".", "...", ".pdf", undefined, null, 5, {}]) expect(cleanFileName(raw, "application/pdf")).toBe("receipt.pdf");
  });
  it("keeps the whole name within 200 characters, extension included", () => {
    const name = cleanFileName("x".repeat(500) + ".pdf", "application/pdf");
    expect(name).toHaveLength(200);
    expect(name.endsWith(".pdf")).toBe(true);
  });
  it("keeps a hidden-file style name without its leading dot", () => {
    expect(cleanFileName(".hidden.jpg", "image/jpeg")).toBe("hidden.jpg");
  });
  it("keeps non-English names", () => {
    expect(cleanFileName("रसीद 1.pdf", "application/pdf")).toBe("रसीद 1.pdf");
  });
});

describe("receiptKey", () => {
  const user = "a".repeat(24);
  const tx = "0123456789abcdef01234567";
  it("builds a path that fits the only pattern storage accepts", () => {
    const key = receiptKey(user, tx, "image/jpeg", "3f2c1b0a-1111-4222-8333-444455556666");
    expect(key).toBe(`receipts/${user}/${tx}/3f2c1b0a-1111-4222-8333-444455556666.jpg`);
    expect(RECEIPT_KEY_PATTERN.test(key)).toBe(true);
  });
  it("refuses ids or tokens that could point somewhere else", () => {
    expect(() => receiptKey("../x", tx, "image/png", "abcdefgh")).toThrow();
    expect(() => receiptKey(user, "not-an-id", "image/png", "abcdefgh")).toThrow();
    expect(() => receiptKey(user, tx, "image/png", "../../etc")).toThrow();
    expect(() => receiptKey(user, tx, "image/png", "short")).toThrow();
  });
  it("the storage pattern rejects traversal and odd extensions", () => {
    for (const bad of ["../receipts/x", `receipts/${user}/${tx}/../../secret.jpg`, `receipts/${user}/${tx}/abcdefgh.svg`, `receipts/${user}/${tx}/abcdefgh.jpg/../x`, "receipts/a/b/c.jpg", "/etc/passwd"])
      expect(RECEIPT_KEY_PATTERN.test(bad)).toBe(false);
  });
});

describe("inlineDisposition", () => {
  it("has an ASCII fallback and the real name encoded", () => {
    expect(inlineDisposition("bill.pdf")).toBe("inline; filename=\"bill.pdf\"; filename*=UTF-8''bill.pdf");
    const d = inlineDisposition("रसीद (1).pdf");
    expect(d).toContain('filename="____ (1).pdf"'); // one underscore per non-ASCII character
    expect(d).toContain("filename*=UTF-8''%E0%A4%B0");
    expect(d).toContain("%281%29"); // brackets encoded for RFC 5987
  });
  it("cannot be broken out of with quotes or backslashes", () => {
    expect(inlineDisposition('a"b\\c.pdf')).toContain('filename="abc.pdf"');
  });
});

describe("receipt helpers", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(850)).toBe("850 B");
    expect(formatBytes(340 * 1024)).toBe("340 KB");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatBytes(-1)).toBe("");
  });
  it("fits an image within a longest side, keeping its shape and never scaling up", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 }); // never 0
  });
  it("tells images from PDFs", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("application/pdf")).toBe(false);
  });
});
