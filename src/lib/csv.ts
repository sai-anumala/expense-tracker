// CSV export helpers (client-side). Files are generated in the browser from data already loaded;
// nothing is sent to the server.

type Cell = string | number | null | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date-time for spreadsheets in DD/MM/YYYY HH:mm, e.g. "02/11/2026 09:15". */
export function csvDateTime(iso: string | Date | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local date only in DD/MM/YYYY, e.g. "02/11/2026". */
export function csvDate(iso: string | Date | undefined | null) {
  return csvDateTime(iso).split(" ")[0] ?? "";
}

/** Plain number with 2 decimals (no ₹, no grouping) so spreadsheets can sum it. */
export const csvAmount = (n: number | undefined | null) => (n === undefined || n === null ? "" : n.toFixed(2));

function escapeCell(v: Cell) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = v;
  // Neutralise formula injection: text starting with = + - @ (or tab/CR) would run as a formula in Excel.
  // Plain numbers like "-5000.00" are left alone so they stay numeric.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]) {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** Safe file-name fragment: "Ravi K." → "ravi-k". */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    // Drop accents on Latin letters ("Ñuñez" → "nunez") but keep combining marks in other scripts,
    // where they're part of the word (Devanagari vowel signs: "रवि" stays "रवि").
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .normalize("NFC")
    .slice(0, 40) || "export";

export const todayStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Build and download a UTF-8 CSV (with BOM so Excel shows non-Latin names correctly). */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
