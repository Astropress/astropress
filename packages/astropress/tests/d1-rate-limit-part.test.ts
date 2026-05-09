import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createD1RateLimitPart } from "../src/d1-rate-limit-part";

interface PreparedSpy {
	prepare: ReturnType<typeof vi.fn>;
	binds: unknown[][];
	queries: string[];
	runs: number;
}

function makeDb(firstReturn: unknown): PreparedSpy & { db: never } {
	const binds: unknown[][] = [];
	const queries: string[] = [];
	let runs = 0;
	const stmt = (q: string) => {
		queries.push(q);
		return {
			bind(...args: unknown[]) {
				binds.push(args);
				return {
					async first() {
						return firstReturn;
					},
					async run() {
						runs++;
					},
				};
			},
		};
	};
	const prepare = vi.fn(stmt);
	return {
		db: { prepare } as never,
		prepare,
		binds,
		queries,
		get runs() {
			return runs;
		},
	} as PreparedSpy & { db: never };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-05-03T00:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createD1RateLimitPart.checkRateLimit", () => {
	it("inserts a fresh row when no row exists and returns true", async () => {
		const m = makeDb(null);
		const part = createD1RateLimitPart(m.db);
		const ok = await part.checkRateLimit("k", 5, 60_000);
		expect(ok).toBe(true);
		// Pin the SELECT-query StringLiteral mutation: the read query MUST be
		// the rate-limits SELECT, not "" or any other string.
		expect(
			m.queries.some(
				(q) =>
					q.includes("SELECT") &&
					q.includes("rate_limits") &&
					q.includes("window_ms") &&
					q.includes("LIMIT 1"),
			),
		).toBe(true);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(true);
		// Bound args of the INSERT include (key, now, windowMs).
		const insertBind = m.binds.find((b) => typeof b[0] === "string" && b.length === 3);
		expect(insertBind?.[0]).toBe("k");
		expect(insertBind?.[2]).toBe(60_000);
	});

	it("inserts a fresh row when window has expired", async () => {
		const m = makeDb({ count: 99, window_start_ms: 0, window_ms: 1 });
		const part = createD1RateLimitPart(m.db);
		const ok = await part.checkRateLimit("k", 5, 1);
		expect(ok).toBe(true);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(true);
	});

	it("increments count when under limit and returns true", async () => {
		const now = Date.now();
		const m = makeDb({
			count: 2,
			window_start_ms: now - 100,
			window_ms: 60_000,
		});
		const part = createD1RateLimitPart(m.db);
		const ok = await part.checkRateLimit("k", 5, 60_000);
		expect(ok).toBe(true);
		expect(m.queries.some((q) => q.includes("UPDATE rate_limits SET count = count + 1"))).toBe(
			true,
		);
	});

	it("returns false when count is at the limit", async () => {
		const now = Date.now();
		const m = makeDb({
			count: 5,
			window_start_ms: now - 100,
			window_ms: 60_000,
		});
		const part = createD1RateLimitPart(m.db);
		const ok = await part.checkRateLimit("k", 5, 60_000);
		expect(ok).toBe(false);
	});

	it("treats elapsed === windowMs as still-in-window (boundary)", async () => {
		// Pins the EqualityOperator mutation `> windowMs` -> `>= windowMs`.
		// At elapsed exactly equal to windowMs the original returns false
		// (still in window, increment); the mutant would treat it as expired
		// and INSERT instead of UPDATE.
		const now = Date.now();
		const m = makeDb({
			count: 2,
			window_start_ms: now - 60_000,
			window_ms: 60_000,
		});
		const part = createD1RateLimitPart(m.db);
		await part.checkRateLimit("k", 5, 60_000);
		expect(m.queries.some((q) => q.includes("UPDATE rate_limits SET count = count + 1"))).toBe(
			true,
		);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(false);
	});
});

describe("createD1RateLimitPart.peekRateLimit", () => {
	it("returns true when no row exists (does not write)", async () => {
		const m = makeDb(null);
		const part = createD1RateLimitPart(m.db);
		expect(await part.peekRateLimit("k", 5, 60_000)).toBe(true);
		expect(m.runs).toBe(0);
	});

	it("returns true when window has expired", async () => {
		const m = makeDb({ count: 99, window_start_ms: 0 });
		const part = createD1RateLimitPart(m.db);
		expect(await part.peekRateLimit("k", 5, 1)).toBe(true);
	});

	it("returns true when count is below limit", async () => {
		const now = Date.now();
		const m = makeDb({ count: 4, window_start_ms: now - 100 });
		const part = createD1RateLimitPart(m.db);
		expect(await part.peekRateLimit("k", 5, 60_000)).toBe(true);
	});

	it("returns false when count is at limit", async () => {
		const now = Date.now();
		const m = makeDb({ count: 5, window_start_ms: now - 100 });
		const part = createD1RateLimitPart(m.db);
		expect(await part.peekRateLimit("k", 5, 60_000)).toBe(false);
	});

	it("uses the rate-limits SELECT query (no LIMIT/columns mutation to '')", async () => {
		const m = makeDb(null);
		await createD1RateLimitPart(m.db).peekRateLimit("k", 5, 1);
		expect(
			m.queries.some(
				(q) => q.includes("SELECT") && q.includes("rate_limits") && q.includes("LIMIT 1"),
			),
		).toBe(true);
	});

	it("treats elapsed === windowMs as still-in-window (boundary)", async () => {
		const now = Date.now();
		const m = makeDb({ count: 5, window_start_ms: now - 60_000 });
		const part = createD1RateLimitPart(m.db);
		// At elapsed===windowMs: original returns row.count<max → 5<5=false.
		// Mutant `>= windowMs` would short-circuit to true (window expired).
		expect(await part.peekRateLimit("k", 5, 60_000)).toBe(false);
	});
});

describe("createD1RateLimitPart.recordFailedAttempt", () => {
	it("inserts fresh row when no row exists", async () => {
		const m = makeDb(null);
		const part = createD1RateLimitPart(m.db);
		await part.recordFailedAttempt("k", 5, 60_000);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(true);
	});

	it("inserts fresh row when window has expired", async () => {
		const m = makeDb({ count: 99, window_start_ms: 0 });
		const part = createD1RateLimitPart(m.db);
		await part.recordFailedAttempt("k", 5, 1);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(true);
	});

	it("increments count when row exists within window", async () => {
		const now = Date.now();
		const m = makeDb({ count: 2, window_start_ms: now - 100 });
		const part = createD1RateLimitPart(m.db);
		await part.recordFailedAttempt("k", 5, 60_000);
		expect(m.queries.some((q) => q.includes("UPDATE rate_limits SET count = count + 1"))).toBe(
			true,
		);
	});

	it("uses the rate-limits SELECT query (no StringLiteral mutation)", async () => {
		const m = makeDb(null);
		await createD1RateLimitPart(m.db).recordFailedAttempt("k", 5, 1);
		expect(
			m.queries.some(
				(q) => q.includes("SELECT") && q.includes("rate_limits") && q.includes("LIMIT 1"),
			),
		).toBe(true);
	});

	it("treats elapsed === windowMs as still-in-window (boundary)", async () => {
		const now = Date.now();
		const m = makeDb({ count: 2, window_start_ms: now - 60_000 });
		const part = createD1RateLimitPart(m.db);
		await part.recordFailedAttempt("k", 5, 60_000);
		// At elapsed===windowMs: original UPDATEs (still-in-window).
		// Mutant `>= windowMs` would INSERT (window expired).
		expect(m.queries.some((q) => q.includes("UPDATE rate_limits SET count = count + 1"))).toBe(
			true,
		);
		expect(m.queries.some((q) => q.includes("INSERT INTO rate_limits"))).toBe(false);
	});
});
