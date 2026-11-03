import { describe, expect, it } from "vitest";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "../authInput";

describe("normalizeEmail", () => {
  it("trims and lower-cases; non-strings → empty", () => {
    expect(normalizeEmail("  Sai.A@Example.COM ")).toBe("sai.a@example.com");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
  });
});

describe("validateEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const e of ["a@b.co", "first.last+tag@mail.example.in", "test.user@ledgerly-demo.dev"]) expect(validateEmail(e)).toBeNull();
  });

  it("requires a value", () => {
    expect(validateEmail("")).toBe("Email is required.");
  });

  it("rejects malformed addresses", () => {
    for (const e of ["plain", "a@b", "a@b.c", "a b@c.com", "@c.com", "a@@c.com", "a@c .com"]) {
      expect(validateEmail(e)).toBe("Enter a valid email address.");
    }
  });

  it("rejects addresses longer than 254 characters", () => {
    const local = "a".repeat(64);
    const ok = `${local}@${"d".repeat(185)}.com`; // 254
    expect(ok).toHaveLength(254);
    expect(validateEmail(ok)).toBeNull();
    expect(validateEmail(`a${ok}`)).toBe("Enter a valid email address.");
  });
});

describe("validatePassword", () => {
  it("8 to 72 characters", () => {
    expect(validatePassword("1234567")).toBe("Password must be at least 8 characters.");
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("p".repeat(72))).toBeNull();
    expect(validatePassword("p".repeat(73))).toBe("Password must be 72 characters or fewer.");
  });

  it("required and must be a string; spaces are not trimmed", () => {
    expect(validatePassword("")).toBe("Password is required.");
    expect(validatePassword(undefined)).toBe("Password is required.");
    expect(validatePassword(12345678)).toBe("Password is required.");
    expect(validatePassword("        ")).toBeNull();
  });
});

describe("validateName", () => {
  it("trims and accepts 1–60 characters", () => {
    expect(validateName("  Sai  ")).toEqual({ name: "Sai", error: null });
    expect(validateName("n".repeat(60)).error).toBeNull();
  });

  it("required", () => {
    expect(validateName("   ")).toEqual({ name: "", error: "Name is required." });
    expect(validateName(null)).toEqual({ name: "", error: "Name is required." });
  });

  it("rejects more than 60 characters", () => {
    expect(validateName("n".repeat(61)).error).toBe("Name must be 60 characters or fewer.");
  });
});
