import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ connectDb: vi.fn(), ensureIndexes: vi.fn() }));
const model = vi.hoisted(() => ({
  collection: { findOneAndUpdate: vi.fn() },
  findOne: vi.fn(),
  deleteOne: vi.fn(),
}));
vi.mock("../db", () => db);
vi.mock("@/models/RateLimit", () => ({ RateLimitModel: model }));

import { check, clear, hit } from "../rateLimit";

const never = () => new Promise<never>(() => {});
const ALLOW = { allowed: true, retryAfterSec: 0 };

describe("rate limit steps never hold up a request", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.connectDb.mockResolvedValue(undefined);
    db.ensureIndexes.mockResolvedValue(undefined);
  });

  it.each([
    ["hit", () => hit("k", 5, 1000), ALLOW],
    ["check", () => check("k", 5), ALLOW],
    ["clear", () => clear("k"), undefined],
  ] as const)("%s allows the request when the database stalls", async (_name, run, expected) => {
    vi.useFakeTimers();
    db.connectDb.mockImplementation(never);
    const result = run();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual(expected);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("timed out"));
  });

  it("hit allows the request when building indexes stalls", async () => {
    vi.useFakeTimers();
    db.ensureIndexes.mockImplementation(never);
    const result = hit("k", 5, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual(ALLOW);
  });

  it("hit allows the request when the database errors", async () => {
    db.connectDb.mockRejectedValue(new Error("down"));
    await expect(hit("k", 5, 1000)).resolves.toEqual(ALLOW);
    expect(console.error).toHaveBeenCalledWith("rateLimit.hit failed (allowing request)", expect.any(Error));
  });

  it("hit still blocks once the limit is passed", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    model.collection.findOneAndUpdate.mockResolvedValue({ count: 6, expiresAt });
    const result = await hit("k", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("check still blocks at the limit", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    model.findOne.mockReturnValue({ lean: () => Promise.resolve({ count: 5, expiresAt }) });
    expect((await check("k", 5)).allowed).toBe(false);
  });
});
