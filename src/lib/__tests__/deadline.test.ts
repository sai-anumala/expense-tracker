import { describe, expect, it, vi } from "vitest";
import { withDeadline } from "../deadline";

describe("withDeadline", () => {
  it("returns the work's result when it finishes in time", async () => {
    await expect(withDeadline(Promise.resolve("done"), 1000, () => "late")).resolves.toBe("done");
  });
  it("returns the fallback when the work never finishes", async () => {
    vi.useFakeTimers();
    const result = withDeadline(new Promise<string>(() => {}), 1000, () => "late");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe("late");
  });
  it("passes on the work's error", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 1000, () => "late")).rejects.toThrow("boom");
  });
});
