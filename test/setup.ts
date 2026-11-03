import { afterEach, vi } from "vitest";

process.env.TZ = "Asia/Kolkata";
// Unit tests never talk to a database.
delete process.env.MONGODB_URI;

afterEach(() => {
  vi.useRealTimers();
});
