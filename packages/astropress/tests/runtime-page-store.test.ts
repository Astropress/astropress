/**
 * runtime-page-store mutation pins.
 *
 * Targets survivors in runtime-page-store.ts that aren't covered by the
 * thinner monitoring/content-search suites: getSeededContentRecords' .map
 * callback, the searchRuntimeContentStates config-gate paths,
 * getRuntimeContentStateByPath's normalize-and-find logic, and the
 * getRuntimeTranslationState body.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { SeededContentRecord } from "../src/runtime-page-store-helpers.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function setCmsConfig(extra: Record<string, unknown> = {}) {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = {
		siteName: "Test Site",
		siteUrl: "https://example.com",
		templateKeys: [],
		seedPages: [],
		archives: [],
		translationStatus: [],
		...extra,
	};
}

function clearCmsConfig() {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = null;
}

vi.mock("../src/admin-store-dispatch.js", async () => {
	const actual = await vi.importActual<typeof import("../src/admin-store-dispatch.js")>(
		"../src/admin-store-dispatch.js",
	);
	return {
		...actual,
		// Force the static-read-store fallback path so seedPages drives the store.
		safeLoadLocalAdminStore: vi.fn(async () => null),
	};
});

const seededRecord: SeededContentRecord = {
	slug: "about",
	legacyUrl: "/about",
	title: "About",
	status: "published",
	body: "<p>about</p>",
	listingItems: [],
	paginationLinks: [],
	updatedAt: "2026-01-01T00:00:00Z",
	updatedBy: "admin@example.com",
	// audit-boundary: opaque-passthrough -- seeded test fixture; satisfies SeededContentRecord at runtime
} as unknown as SeededContentRecord;

afterEach(() => {
	clearCmsConfig();
	vi.restoreAllMocks();
});

describe("searchRuntimeContentStates — peekCmsConfig safety", () => {
	it("returns [] without throwing when peekCmsConfig() resolves to null (kills L153 OptionalChaining mutants)", async () => {
		clearCmsConfig();
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { searchRuntimeContentStates } = await import("../src/runtime-page-store.js");
		// Original: peekCmsConfig() === null → null?.search → undefined → falsy → returns [].
		// Mutants removing optional chaining: null.search throws TypeError. This asserts no-throw.
		await expect(searchRuntimeContentStates("anything")).resolves.toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("with search.enabled=true delegates to the local admin store (kills L153:6 ConditionalExpression:true)", async () => {
		setCmsConfig({ search: { enabled: true } });
		const searchSpy = vi.fn(async (q: string) => [
			{ slug: `hit-${q}`, legacyUrl: `/hit/${q}`, title: q } as never,
		]);
		const dispatch = await import("../src/admin-store-dispatch.js");
		(dispatch.safeLoadLocalAdminStore as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			{
				searchContentStates: searchSpy,
			} as never,
		);

		const { searchRuntimeContentStates } = await import("../src/runtime-page-store.js");
		const results = await searchRuntimeContentStates("hello");
		// Mutated `if (true)` short-circuits to [] regardless of config — assertion catches it.
		expect(results).toHaveLength(1);
		expect(searchSpy).toHaveBeenCalledWith("hello");
	});
});

describe("searchRuntimeContentStates — additional pin survivors", () => {
	it("with config missing the entire `search` key falls through gracefully (kills L153:7 OptionalChaining peekCmsConfig()?.search.enabled)", async () => {
		setCmsConfig({}); // no `search` property at all
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { searchRuntimeContentStates } = await import("../src/runtime-page-store.js");
		// Original: cfg.search is undefined → cfg?.search?.enabled → undefined → falsy →
		//   returns []. Mutant removing the second `?`: cfg.search.enabled throws TypeError on
		//   undefined.enabled. Assertion asserts no-throw.
		await expect(searchRuntimeContentStates("q")).resolves.toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("when search.enabled=true and the admin store is missing entirely, falls through without throwing (kills L160:6 ConditionalExpression:true and OptionalChaining store.searchContentStates)", async () => {
		setCmsConfig({ search: { enabled: true } });
		const dispatch = await import("../src/admin-store-dispatch.js");
		(dispatch.safeLoadLocalAdminStore as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			null,
		);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { searchRuntimeContentStates } = await import("../src/runtime-page-store.js");
		// Original: store is null → store?.searchContentStates → undefined → falsy → checks db
		//   (none) → final warn-and-return-[].
		// Mutant L160:6 ConditionalExpression:true: enters the branch unconditionally → null.searchContentStates() throws.
		// Mutant L160:6 OptionalChaining store.searchContentStates: null.searchContentStates throws.
		await expect(searchRuntimeContentStates("q")).resolves.toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no FTS-capable store"));
	});
});

describe("getRuntimeContentStateByPath — path normalization & lookup", () => {
	it("finds a seeded record by exact /-prefixed pathname (kills L171 BlockStatement, L172:25 endsWith, L174 LogicalOperator/ArrowFunction, L16:3 ArrowFunction)", async () => {
		setCmsConfig({ seedPages: [{ ...seededRecord }] });
		const { getRuntimeContentStateByPath } = await import("../src/runtime-page-store.js");
		// Original: startsWith("/") true → normalizedPath="/about" → finds record.
		// L172:25 MethodExpression endsWith: "/about".endsWith("/")=false →
		//   normalizedPath="/" + "/about" = "//about" → no match → null.
		// L171 BlockStatement {}: returns undefined → assertion fails.
		// L174 LogicalOperator &&: returns null when record found.
		// L174 ArrowFunction () => undefined: find returns undefined → returns null.
		// L16 ArrowFunction () => undefined: seededContentRecords contains undefined entries →
		//   record.legacyUrl access throws TypeError on .find().
		const found = await getRuntimeContentStateByPath("/about");
		expect(found).not.toBeNull();
		expect(found?.legacyUrl).toBe("/about");
	});

	it("picks the legacyUrl-matching record from a multi-record list (kills L174:34 ConditionalExpression:true)", async () => {
		const other: SeededContentRecord = {
			...seededRecord,
			slug: "other",
			legacyUrl: "/other",
			title: "Other",
		} as SeededContentRecord;
		// Order matters: 'other' first, 'about' second. Mutant find(record => true) returns the first.
		setCmsConfig({ seedPages: [other, { ...seededRecord }] });
		const { getRuntimeContentStateByPath } = await import("../src/runtime-page-store.js");
		const found = await getRuntimeContentStateByPath("/about");
		// Original predicate filters to legacyUrl="/about" → seededRecord.
		// Mutant `find(() => true)` returns 'other' (index 0).
		expect(found?.legacyUrl).toBe("/about");
		expect(found?.slug).toBe("about");
	});

	it("prepends '/' to a bare pathname before lookup (kills L172:45 StringLiteral)", async () => {
		setCmsConfig({ seedPages: [{ ...seededRecord }] });
		const { getRuntimeContentStateByPath } = await import("../src/runtime-page-store.js");
		// Original: startsWith("/") false → normalizedPath="/about" → finds.
		// L172:45 StringLiteral "": startsWith("") true → normalizedPath="about" (no slash) →
		//   no match against legacyUrl="/about" → null.
		const found = await getRuntimeContentStateByPath("about");
		expect(found?.legacyUrl).toBe("/about");
	});
});

describe("getSeededContentRecords — narrowing ternaries", () => {
	it("propagates string-typed kind/scheduledAt through the narrowing ternaries (kills L19/L23 ConditionalExpression:false, EqualityOperator !==, StringLiteral)", async () => {
		const fullyTyped = {
			...seededRecord,
			kind: "post",
			scheduledAt: "2026-01-01T00:00:00Z",
		} as unknown as SeededContentRecord;
		setCmsConfig({ seedPages: [fullyTyped] });
		const { listRuntimeContentStates } = await import("../src/runtime-page-store.js");
		const records = await listRuntimeContentStates();
		const r = records[0];
		// Original (typeof === "string"): both fields preserved as strings.
		// Mutants ConditionalExpression:false / EqualityOperator !== / StringLiteral "":
		// flip the narrowing to the undefined branch → both fields become undefined.
		expect(r.kind).toBe("post");
		expect(r.scheduledAt).toBe("2026-01-01T00:00:00Z");
	});

	it("non-string kind/scheduledAt are scrubbed to undefined (kills L19/L23 ConditionalExpression:true)", async () => {
		const mistyped = {
			...seededRecord,
			kind: 42 as unknown as string,
			scheduledAt: { not: "a string" } as unknown as string,
		} as unknown as SeededContentRecord;
		setCmsConfig({ seedPages: [mistyped] });
		const { listRuntimeContentStates } = await import("../src/runtime-page-store.js");
		const records = await listRuntimeContentStates();
		const r = records[0];
		// Original: typeof !== "string" → undefined.
		// Mutant ConditionalExpression:true: always returns the raw page.kind / page.scheduledAt →
		//   the non-string values leak through, failing strict-undefined assertion.
		expect(r.kind).toBeUndefined();
		expect(r.scheduledAt).toBeUndefined();
	});
});

describe("searchRuntimeContentStates — D1 search delegation", () => {
	it("delegates to searchD1ContentStates when search is enabled and a D1 binding is present (kills L164:6 ConditionalExpression:false)", async () => {
		setCmsConfig({ search: { enabled: true } });
		const fakeRow = { slug: "d1-hit" } as never;
		const d1 = await import("../src/d1-store-content.js");
		const spy = vi.spyOn(d1, "searchD1ContentStates").mockResolvedValueOnce([fakeRow]);
		const locals = {
			runtime: { env: { DB: { prepare: () => ({}) } } },
		} as unknown as App.Locals;
		const { searchRuntimeContentStates } = await import("../src/runtime-page-store.js");
		const results = await searchRuntimeContentStates("query", locals);
		// Original enters the `if (db)` branch and calls searchD1ContentStates.
		// Mutant L164:6 ConditionalExpression:false skips → warn-and-return-[].
		expect(spy).toHaveBeenCalledWith(expect.anything(), "query");
		expect(results).toEqual([fakeRow]);
	});
});

describe("getRuntimeTranslationState — fallback path body", () => {
	it("returns the fallback string from the static read store (kills L185 BlockStatement)", async () => {
		setCmsConfig();
		const { getRuntimeTranslationState } = await import("../src/runtime-page-store.js");
		// Static read store's getEffectiveTranslationState(route, fallback) returns the
		// `fallback` argument verbatim. L185 mutated body returns undefined → assertion fails.
		const state = await getRuntimeTranslationState("/some/route", "in_progress");
		expect(state).toBe("in_progress");
	});
});
