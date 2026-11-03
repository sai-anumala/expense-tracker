import { describe, expect, it, vi } from "vitest";
import { csvAmount, csvDate, csvDateTime, slug, todayStamp, toCsv } from "../csv";
import { iso, local } from "./fixtures";

describe("csvDateTime / csvDate", () => {
  it("formats local time as DD/MM/YYYY HH:mm with zero padding (24h)", () => {
    expect(csvDateTime(iso(2026, 11, 2, 9, 5))).toBe("02/11/2026 09:05");
    expect(csvDateTime(local(2026, 12, 31, 23, 59))).toBe("31/12/2026 23:59");
  });

  it("converts UTC ISO strings to local time (IST, +05:30)", () => {
    expect(csvDateTime("2026-11-01T20:00:00.000Z")).toBe("02/11/2026 01:30");
    expect(csvDate("2026-11-01T20:00:00.000Z")).toBe("02/11/2026");
  });

  it("csvDate drops the time", () => {
    expect(csvDate(iso(2026, 1, 7, 18, 45))).toBe("07/01/2026");
  });

  it("empty for missing or invalid input", () => {
    for (const v of [undefined, null, "", "not a date"]) {
      expect(csvDateTime(v)).toBe("");
      expect(csvDate(v)).toBe("");
    }
  });
});

describe("csvAmount", () => {
  it("2 decimals, no symbol or grouping, sign kept", () => {
    expect(csvAmount(1234567.891)).toBe("1234567.89");
    expect(csvAmount(-5000)).toBe("-5000.00");
    expect(csvAmount(0)).toBe("0.00");
  });
  it("empty for null/undefined", () => {
    expect(csvAmount(null)).toBe("");
    expect(csvAmount(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("joins cells with commas and rows with CRLF; null/undefined are empty", () => {
    expect(toCsv([["a", 1, null, undefined], [], ["b"]])).toBe("a,1,,\r\n\r\nb");
  });

  it("quotes cells with commas, quotes or newlines and doubles inner quotes", () => {
    expect(toCsv([["Swiggy, Zomato", 'He said "hi"', "line1\nline2", "cr\rhere", "plain"]])).toBe(
      '"Swiggy, Zomato","He said ""hi""","line1\nline2","cr\rhere",plain',
    );
  });

  it("guards formula injection: text starting with = + - @ tab or CR gets a leading '", () => {
    expect(toCsv([["=SUM(A1:A2)", "+91 98765", "-cmd", "@import", "\tx"]])).toBe("'=SUM(A1:A2),'+91 98765,'-cmd,'@import,'\tx");
    // Guarded text is still quoted when needed.
    expect(toCsv([['=HYPERLINK("x","y")']])).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });

  it("leaves plain numeric strings (including negatives) numeric", () => {
    expect(toCsv([["-5000.00", "-5", "5000.00", "0"]])).toBe("-5000.00,-5,5000.00,0");
  });

  it("guards numeric-looking strings that aren't plain numbers", () => {
    expect(toCsv([["+5000", "-1,000", "-5e3"]])).toBe(`'+5000,"'-1,000",'-5e3`);
  });

  it("number cells are written as-is (never guarded)", () => {
    expect(toCsv([[-5000, 12.5]])).toBe("-5000,12.5");
  });

  it("text in the middle of a cell isn't guarded", () => {
    expect(toCsv([["a=b", "x-y"]])).toBe("a=b,x-y");
  });
});

describe("slug", () => {
  it("lower-cases and hyphenates", () => {
    expect(slug("Ravi K.")).toBe("ravi-k");
    expect(slug("  HDFC   Bank / Loan  ")).toBe("hdfc-bank-loan");
  });

  it("strips Latin accents at the end of a word", () => {
    expect(slug("José")).toBe("jose");
    expect(slug("Zoë")).toBe("zoe");
  });

  it("falls back to 'export' when nothing is left", () => {
    expect(slug("")).toBe("export");
    expect(slug("!!! ...")).toBe("export");
  });

  it("caps length at 40 characters", () => {
    expect(slug("a".repeat(60))).toHaveLength(40);
  });

  // BUG (src/lib/csv.ts:43): `[^\p{L}\p{N}]` treats combining marks (Unicode Mn/Mc, which NFKD also produces
  // from accented letters) as separators, so words are split mid-way: "रवि कुमार" → "रव-क-म-र",
  // "Ñuñez" → "n-un-ez". Only marks at the end of a word survive because trailing hyphens are trimmed.
  it.fails("keeps Indic names intact (Devanagari vowel signs are part of the word)", () => {
    expect(slug("रवि कुमार")).toBe("रवि-कुमार");
  });
  it.fails("strips accents in the middle of a word without splitting it", () => {
    expect(slug("Ñuñez")).toBe("nunez");
  });
});

describe("todayStamp", () => {
  it("YYYY-MM-DD in local time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T20:00:00.000Z")); // 3 Nov 01:30 IST
    expect(todayStamp()).toBe("2026-11-03");
  });
});
