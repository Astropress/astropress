import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordD1Audit } from "../src/d1-audit";
import type { D1DatabaseLike } from "../src/d1-database";
import type { Actor } from "../src/persistence-types";

interface CapturedCall {
	sql: string;
	bindings: unknown[];
}

function makeDb(calls: CapturedCall[]): D1DatabaseLike {
	return {
		prepare(sql: string) {
			const stmt = {
				bindings: [] as unknown[],
				bind(...values: unknown[]) {
					stmt.bindings = values;
					return stmt as unknown as ReturnType<D1DatabaseLike["prepare"]>;
				},
				async first() {
					return null;
				},
				async all() {
					return { success: true, results: [] };
				},
				async run() {
					calls.push({ sql, bindings: stmt.bindings });
					return { success: true, results: [] };
				},
			};
			return stmt as unknown as ReturnType<D1DatabaseLike["prepare"]>;
		},
		async batch() {
			return [];
		},
	};
}

const actor: Actor = { email: "alice@example.com" };

beforeEach(() => {
	// getCloudflareBindings reads a global — set it explicitly per test.
	(
		globalThis as unknown as Record<string, unknown>
	).__astropressCloudflareBindings = {};
});

afterEach(() => {
	(
		globalThis as unknown as Record<string, unknown>
	).__astropressCloudflareBindings = undefined;
	vi.resetModules();
});

describe("recordD1Audit", () => {
	it("returns early (no throw) when no DB binding is present", async () => {
		// Empty bindings object — DB is undefined.
		await expect(
			recordD1Audit(null, actor, "publish", "content", "slug-1", "summary"),
		).resolves.toBeUndefined();
	});

	it("inserts with the expected SQL and bindings in actor/action/type/id/summary order", async () => {
		const calls: CapturedCall[] = [];
		(
			globalThis as unknown as Record<string, unknown>
		).__astropressCloudflareBindings = {
			DB: makeDb(calls),
		};

		await recordD1Audit(null, actor, "publish", "content", "slug-1", "summary");

		expect(calls.length).toBeGreaterThanOrEqual(1);
		const insert = calls[0];
		expect(insert.sql).toContain("INSERT INTO audit_events");
		expect(insert.sql).toContain(
			"(user_email, action, resource_type, resource_id, summary)",
		);
		expect(insert.bindings).toEqual([
			"alice@example.com",
			"publish",
			"content",
			"slug-1",
			"summary",
		]);
	});

	it("issues a retention DELETE with the configured days when retention > 0", async () => {
		const calls: CapturedCall[] = [];
		(
			globalThis as unknown as Record<string, unknown>
		).__astropressCloudflareBindings = {
			DB: makeDb(calls),
		};

		await recordD1Audit(null, actor, "a", "r", "id", "s");

		// Second call is the retention DELETE.
		expect(calls.length).toBe(2);
		expect(calls[1].sql).toContain("DELETE FROM audit_events");
		expect(calls[1].sql).toContain("datetime('now'");
		// Default retention in the absence of peekCmsConfig() is 90 days.
		expect(calls[1].bindings).toEqual([90]);
	});

	it("skips the retention DELETE when peekCmsConfig returns auditRetentionDays=0", async () => {
		vi.resetModules();
		vi.doMock("../src/config", () => ({
			peekCmsConfig: () => ({ auditRetentionDays: 0 }),
		}));
		const calls: CapturedCall[] = [];
		(
			globalThis as unknown as Record<string, unknown>
		).__astropressCloudflareBindings = {
			DB: makeDb(calls),
		};
		const mod = await import("../src/d1-audit");
		await mod.recordD1Audit(null, actor, "a", "r", "id", "s");

		expect(calls.length).toBe(1);
		expect(calls[0].sql).toContain("INSERT INTO audit_events");
		vi.doUnmock("../src/config");
	});

	it("uses a custom auditRetentionDays from peekCmsConfig", async () => {
		vi.resetModules();
		vi.doMock("../src/config", () => ({
			peekCmsConfig: () => ({ auditRetentionDays: 7 }),
		}));
		const calls: CapturedCall[] = [];
		(
			globalThis as unknown as Record<string, unknown>
		).__astropressCloudflareBindings = {
			DB: makeDb(calls),
		};
		const mod = await import("../src/d1-audit");
		await mod.recordD1Audit(null, actor, "a", "r", "id", "s");

		expect(calls.length).toBe(2);
		expect(calls[1].bindings).toEqual([7]);
		vi.doUnmock("../src/config");
	});

	it("falls back to 90-day retention when peekCmsConfig returns undefined", async () => {
		vi.resetModules();
		vi.doMock("../src/config", () => ({
			peekCmsConfig: () => undefined,
		}));
		const calls: CapturedCall[] = [];
		(
			globalThis as unknown as Record<string, unknown>
		).__astropressCloudflareBindings = {
			DB: makeDb(calls),
		};
		const mod = await import("../src/d1-audit");
		await mod.recordD1Audit(null, actor, "a", "r", "id", "s");

		expect(calls.length).toBe(2);
		expect(calls[1].bindings).toEqual([90]);
		vi.doUnmock("../src/config");
	});
});
