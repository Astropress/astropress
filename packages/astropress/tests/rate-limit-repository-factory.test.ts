import { describe, expect, it, vi } from "vitest";
import { createAstropressRateLimitRepository } from "../src/rate-limit-repository-factory";

describe("createAstropressRateLimitRepository", () => {
  it("resets and allows when the key has no active window", () => {
    const resetRateLimitWindow = vi.fn();
    const repository = createAstropressRateLimitRepository({
      now: vi.fn(() => 1_000),
      readRateLimitWindow: vi.fn(() => null),
      resetRateLimitWindow,
      incrementRateLimitWindow: vi.fn(),
    });

    expect(repository.checkRateLimit("login:test", 3, 60_000)).toBe(true);
    expect(resetRateLimitWindow).toHaveBeenCalledWith("login:test", 1_000, 60_000);
  });

  it("increments while the window is still under the limit", () => {
    const incrementRateLimitWindow = vi.fn();
    const repository = createAstropressRateLimitRepository({
      now: vi.fn(() => 5_000),
      readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000, windowMs: 60_000 })),
      resetRateLimitWindow: vi.fn(),
      incrementRateLimitWindow,
    });

    expect(repository.checkRateLimit("login:test", 3, 60_000)).toBe(true);
    expect(incrementRateLimitWindow).toHaveBeenCalledWith("login:test");
  });

  it("blocks when the current window already hit the max", () => {
    const repository = createAstropressRateLimitRepository({
      now: vi.fn(() => 5_000),
      readRateLimitWindow: vi.fn(() => ({ count: 3, windowStartMs: 1_000, windowMs: 60_000 })),
      resetRateLimitWindow: vi.fn(),
      incrementRateLimitWindow: vi.fn(),
    });

    expect(repository.checkRateLimit("login:test", 3, 60_000)).toBe(false);
  });

  it("peeks without incrementing the count", () => {
    const incrementRateLimitWindow = vi.fn();
    const repository = createAstropressRateLimitRepository({
      now: vi.fn(() => 5_000),
      readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000 })),
      resetRateLimitWindow: vi.fn(),
      incrementRateLimitWindow,
    });

    expect(repository.peekRateLimit("login:test", 3, 60_000)).toBe(true);
    expect(incrementRateLimitWindow).not.toHaveBeenCalled();
  });

  it("records failed attempts by extending the active window", () => {
    const incrementRateLimitWindow = vi.fn();
    const repository = createAstropressRateLimitRepository({
      now: vi.fn(() => 5_000),
      readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000 })),
      resetRateLimitWindow: vi.fn(),
      incrementRateLimitWindow,
    });

    repository.recordFailedAttempt("login:test", 3, 60_000);
    expect(incrementRateLimitWindow).toHaveBeenCalledWith("login:test");
  });
});
