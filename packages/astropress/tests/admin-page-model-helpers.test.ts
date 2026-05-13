/**
 * admin-page-model-helpers mutation pins.
 *
 * Targets ArrayDeclaration `[]` → `["Stryker was here"]` survivors in
 * emptyDashboardModel and the default-warnings parameter of `result`, and
 * the `settled.some` vs `.every` boundary in withSettledMap.
 */

import { describe, expect, it } from "vitest";

import {
	emptyDashboardModel,
	forbidden,
	notFound,
	ok,
	result,
	withSettledMap,
} from "../src/admin-page-model-helpers.js";

describe("emptyDashboardModel", () => {
	it("seeds every list field with a fresh empty array (kills L84-L98 ArrayDeclaration mutants)", () => {
		const model = emptyDashboardModel();
		// Each per-field assertion targets one of the L84-L98 mutants
		// (`[]` → `["Stryker was here"]`). toEqual([]) fails on any non-empty seed.
		expect(model.auditEvents).toEqual([]);
		expect(model.comments).toEqual([]);
		expect(model.redirectRules).toEqual([]);
		expect(model.routePages).toEqual([]);
		expect(model.contentStates).toEqual([]);
		expect(model.systemRoutes).toEqual([]);
		expect(model.posts).toEqual([]);
		expect(model.pages).toEqual([]);
		expect(model.reviewPosts).toEqual([]);
		expect(model.scheduledPosts).toEqual([]);
		expect(model.recentAuditEvents).toEqual([]);
		expect(model.recentActivity).toEqual([]);
		expect(model.archiveRoutes).toEqual([]);
		expect(model.supportSurfaceLinks).toEqual([]);
		expect(model.translationNeedsAttention).toBe(0);
		expect(model.seoNeedsAttention).toBe(0);
		expect(model.latestDeployment).toBeNull();
	});
});

describe("result/ok/forbidden/notFound default warnings parameter", () => {
	it("result() defaults warnings to a fresh empty array (kills L16:73 ArrayDeclaration)", () => {
		// Original: result("ok", {}, []) → warnings=[].
		// Mutant L16:73: warnings parameter default becomes ["Stryker was here"].
		expect(result("ok", { value: 1 }).warnings).toEqual([]);
	});

	it("ok() with no warnings produces status 'ok' and empty warnings", () => {
		const r = ok({ value: "x" });
		// ok() forwards [] through result()'s default — the L21 ternary picks "ok" when
		// warnings.length === 0. A mutated default of ["Stryker was here"] (length 1) would flip
		// status to "partial".
		expect(r.status).toBe("ok");
		expect(r.warnings).toEqual([]);
	});

	it("forbidden() emits an empty warnings array", () => {
		expect(forbidden({ value: null }).warnings).toEqual([]);
	});

	it("notFound() defaults warnings to []", () => {
		expect(notFound({ value: null }).warnings).toEqual([]);
	});
});

describe("withSettledMap — settled.some(rejected) boundary", () => {
	it("does NOT push a warning when every item resolves (proves .some not .every on no-rejections)", async () => {
		const warnings: string[] = [];
		const out = await withSettledMap(
			warnings,
			"never-pushed",
			[1, 2, 3],
			async (n) => n * 2,
			(n) => -n,
		);
		expect(out).toEqual([2, 4, 6]);
		expect(warnings).toEqual([]);
	});

	it("pushes a warning when ANY item rejects, not only when ALL reject (kills L71 MethodExpression .every)", async () => {
		// Mixed: index 0 rejects, index 1 resolves. some=true, every=false.
		// Original (.some): hadFailure=true → warning pushed.
		// Mutant (.every): hadFailure=false → warning NOT pushed.
		const warnings: string[] = [];
		const out = await withSettledMap(
			warnings,
			"mixed-failures",
			["fail", "ok"] as const,
			async (item) => {
				if (item === "fail") throw new Error("boom");
				return `mapped:${item}`;
			},
			(item) => `fallback:${item}`,
		);
		expect(out).toEqual(["fallback:fail", "mapped:ok"]);
		expect(warnings).toEqual(["mixed-failures"]);
	});

	it("pushes a warning when ALL items reject (proves the .some side of the boundary holds)", async () => {
		const warnings: string[] = [];
		await withSettledMap(
			warnings,
			"all-failed",
			[1, 2],
			async () => {
				throw new Error("nope");
			},
			(n) => `fallback:${n}`,
		);
		expect(warnings).toEqual(["all-failed"]);
	});
});
