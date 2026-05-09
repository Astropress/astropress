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
			readRateLimitWindow: vi.fn(() => ({
				count: 1,
				windowStartMs: 1_000,
				windowMs: 60_000,
			})),
			resetRateLimitWindow: vi.fn(),
			incrementRateLimitWindow,
		});

		expect(repository.checkRateLimit("login:test", 3, 60_000)).toBe(true);
		expect(incrementRateLimitWindow).toHaveBeenCalledWith("login:test");
	});

	it("blocks when the current window already hit the max", () => {
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 5_000),
			readRateLimitWindow: vi.fn(() => ({
				count: 3,
				windowStartMs: 1_000,
				windowMs: 60_000,
			})),
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

	it("checkRateLimit resets when the existing window has expired (now - start > windowMs)", () => {
		const resetRateLimitWindow = vi.fn();
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 70_000),
			// Window started 70s ago (>60s windowMs) → must be reset.
			readRateLimitWindow: vi.fn(() => ({ count: 5, windowStartMs: 1_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow,
		});

		expect(repository.checkRateLimit("k", 3, 60_000)).toBe(true);
		expect(resetRateLimitWindow).toHaveBeenCalledWith("k", 70_000, 60_000);
		expect(incrementRateLimitWindow).not.toHaveBeenCalled();
	});

	it("checkRateLimit does NOT reset when now-start equals windowMs exactly (kills > to >= mutant)", () => {
		// elapsed = 60_000 exactly. Original `> windowMs` is false → use existing window.
		// Mutant `>= windowMs` would reset and erase the count.
		const resetRateLimitWindow = vi.fn();
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 61_000),
			readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow,
		});
		expect(repository.checkRateLimit("k", 3, 60_000)).toBe(true);
		expect(resetRateLimitWindow).not.toHaveBeenCalled();
		expect(incrementRateLimitWindow).toHaveBeenCalledWith("k");
	});

	it("checkRateLimit blocks at exactly count===max (kills < to <= mutant)", () => {
		// count = max → original `count < max` is false → return false (block).
		// Mutant `count <= max` would still allow at boundary.
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 5_000),
			readRateLimitWindow: vi.fn(() => ({ count: 3, windowStartMs: 1_000 })),
			resetRateLimitWindow: vi.fn(),
			incrementRateLimitWindow,
		});
		expect(repository.checkRateLimit("k", 3, 60_000)).toBe(false);
		expect(incrementRateLimitWindow).not.toHaveBeenCalled();
	});

	it("peekRateLimit returns true when the window has expired (no read of count)", () => {
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 70_000),
			readRateLimitWindow: vi.fn(() => ({ count: 99, windowStartMs: 1_000 })),
			resetRateLimitWindow: vi.fn(),
			incrementRateLimitWindow: vi.fn(),
		});
		expect(repository.peekRateLimit("k", 3, 60_000)).toBe(true);
	});

	it("peekRateLimit returns false at count===max (kills < to <= mutant on peek)", () => {
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 5_000),
			readRateLimitWindow: vi.fn(() => ({ count: 3, windowStartMs: 1_000 })),
			resetRateLimitWindow: vi.fn(),
			incrementRateLimitWindow: vi.fn(),
		});
		expect(repository.peekRateLimit("k", 3, 60_000)).toBe(false);
	});

	it("peekRateLimit does NOT call resetRateLimitWindow even when expired", () => {
		const resetRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 70_000),
			readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow: vi.fn(),
		});
		repository.peekRateLimit("k", 3, 60_000);
		expect(resetRateLimitWindow).not.toHaveBeenCalled();
	});

	it("recordFailedAttempt resets when the existing window has expired", () => {
		const resetRateLimitWindow = vi.fn();
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 70_000),
			readRateLimitWindow: vi.fn(() => ({ count: 9, windowStartMs: 1_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow,
		});
		repository.recordFailedAttempt("k", 3, 60_000);
		expect(resetRateLimitWindow).toHaveBeenCalledWith("k", 70_000, 60_000);
		expect(incrementRateLimitWindow).not.toHaveBeenCalled();
	});

	it("peekRateLimit at exactly elapsed===windowMs returns count<max (kills > to >= mutant on peek)", () => {
		// elapsed = 60_000 exactly. Original `> windowMs` is false → use existing count.
		// Mutant `>= windowMs` would short-circuit to true and ignore the count.
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 61_000),
			readRateLimitWindow: vi.fn(() => ({ count: 3, windowStartMs: 1_000 })),
			resetRateLimitWindow: vi.fn(),
			incrementRateLimitWindow: vi.fn(),
		});
		expect(repository.peekRateLimit("k", 3, 60_000)).toBe(false);
	});

	it("recordFailedAttempt at exactly elapsed===windowMs increments (kills > to >= mutant)", () => {
		const resetRateLimitWindow = vi.fn();
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 61_000),
			readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 1_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow,
		});
		repository.recordFailedAttempt("k", 3, 60_000);
		expect(resetRateLimitWindow).not.toHaveBeenCalled();
		expect(incrementRateLimitWindow).toHaveBeenCalledWith("k");
	});

	it("recordFailedAttempt uses (now - start) elapsed, NOT (now + start) (kills - to + mutant)", () => {
		// Pick numbers where now-start < windowMs but now+start > windowMs.
		// now - start = 10000 (in-window) → original increments.
		// now + start = 70000 (>60000 windowMs) → mutant would reset.
		const resetRateLimitWindow = vi.fn();
		const incrementRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 40_000),
			readRateLimitWindow: vi.fn(() => ({ count: 1, windowStartMs: 30_000 })),
			resetRateLimitWindow,
			incrementRateLimitWindow,
		});
		repository.recordFailedAttempt("k", 3, 60_000);
		expect(incrementRateLimitWindow).toHaveBeenCalledWith("k");
		expect(resetRateLimitWindow).not.toHaveBeenCalled();
	});

	it("recordFailedAttempt resets when there is no existing window", () => {
		const resetRateLimitWindow = vi.fn();
		const repository = createAstropressRateLimitRepository({
			now: vi.fn(() => 1_000),
			readRateLimitWindow: vi.fn(() => null),
			resetRateLimitWindow,
			incrementRateLimitWindow: vi.fn(),
		});
		repository.recordFailedAttempt("k", 3, 60_000);
		expect(resetRateLimitWindow).toHaveBeenCalledWith("k", 1_000, 60_000);
	});
});
