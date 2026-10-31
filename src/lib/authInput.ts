import "server-only";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export function validateEmail(email: string) {
  if (!email) return "Email is required.";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(pw: unknown) {
  if (typeof pw !== "string" || !pw) return "Password is required.";
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 72) return "Password must be 72 characters or fewer."; // bcrypt input limit
  return null;
}

export function validateName(v: unknown) {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { name, error: "Name is required." };
  if (name.length > 60) return { name, error: "Name must be 60 characters or fewer." };
  return { name, error: null };
}
