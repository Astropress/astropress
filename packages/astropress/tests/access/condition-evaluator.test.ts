import { describe, expect, it } from "vitest";

import {
	type BindingContext,
	evaluateCondition,
	resolvePath,
	substituteString,
} from "../../src/access/condition-evaluator";

const baseCtx: BindingContext = {
	user: {
		id: "u1",
		role: "admin",
		attributes: { tier: "gold", count: 7, active: true, missing: null },
	} as never,
	resource: {
		ownerId: "u1",
		kind: "post",
		attributes: { isPublic: true },
	} as never,
	env: { now: 100 } as never,
};

describe("resolvePath", () => {
	it("resolves user.<field>", () => {
		expect(resolvePath("user.id", baseCtx)).toBe("u1");
		expect(resolvePath("user.role", baseCtx)).toBe("admin");
	});

	it("resolves user.attributes.<key>", () => {
		expect(resolvePath("user.attributes.tier", baseCtx)).toBe("gold");
		expect(resolvePath("user.attributes.count", baseCtx)).toBe(7);
	});

	it("resolves resource.<field>", () => {
		expect(resolvePath("resource.ownerId", baseCtx)).toBe("u1");
	});

	it("resolves env.<field>", () => {
		expect(resolvePath("env.now", baseCtx)).toBe(100);
	});

	it("returns undefined when resource is absent", () => {
		expect(resolvePath("resource.ownerId", { user: baseCtx.user })).toBeUndefined();
	});

	it("returns undefined when env is absent", () => {
		expect(resolvePath("env.now", { user: baseCtx.user })).toBeUndefined();
	});

	it("returns undefined for an unknown root", () => {
		expect(resolvePath("nope.x", baseCtx)).toBeUndefined();
	});

	it("returns undefined when a mid-path segment is null/undefined", () => {
		expect(resolvePath("user.attributes.missing.deep", baseCtx)).toBeUndefined();
	});

	it("returns undefined when a mid-path segment is a primitive (not object)", () => {
		// user.id is a string; further descent returns undefined.
		expect(resolvePath("user.id.length", baseCtx)).toBeUndefined();
	});

	it("returns null verbatim when path lands on null", () => {
		expect(resolvePath("user.attributes.missing", baseCtx)).toBeNull();
	});
});

describe("substituteString", () => {
	it("replaces a single ${path} substitution", () => {
		expect(substituteString("hi ${user.id}", baseCtx)).toBe("hi u1");
	});

	it("replaces multiple substitutions in one string", () => {
		expect(substituteString("${user.id}/${resource.ownerId}", baseCtx)).toBe("u1/u1");
	});

	it("leaves a string with no placeholders untouched", () => {
		expect(substituteString("static-str", baseCtx)).toBe("static-str");
	});

	it("substitutes empty string when path resolves to undefined", () => {
		expect(substituteString("[${user.nonexistent}]", baseCtx)).toBe("[]");
	});

	it("substitutes empty string when path resolves to null", () => {
		expect(substituteString("[${user.attributes.missing}]", baseCtx)).toBe("[]");
	});

	it("coerces numbers and booleans to strings", () => {
		expect(substituteString("${user.attributes.count}", baseCtx)).toBe("7");
		expect(substituteString("${user.attributes.active}", baseCtx)).toBe("true");
	});

	it("only matches the documented `${a-zA-Z0-9_.}` pattern (no spaces)", () => {
		expect(substituteString("${user id}", baseCtx)).toBe("${user id}");
	});
});

describe("evaluateCondition", () => {
	describe("stringEquals", () => {
		it("returns true when literal matches", () => {
			expect(
				evaluateCondition(
					{ op: "stringEquals", left: "user.role", right: "admin" } as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns true after right-side ${} substitution", () => {
			expect(
				evaluateCondition(
					{
						op: "stringEquals",
						left: "resource.ownerId",
						right: "${user.id}",
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false when left is undefined (missing path)", () => {
			expect(
				evaluateCondition({ op: "stringEquals", left: "user.nope", right: "x" } as never, baseCtx),
			).toBe(false);
		});

		it("returns false when left is null", () => {
			expect(
				evaluateCondition(
					{
						op: "stringEquals",
						left: "user.attributes.missing",
						right: "x",
					} as never,
					baseCtx,
				),
			).toBe(false);
		});
	});

	describe("stringIn", () => {
		it("returns true when left matches any candidate after substitution", () => {
			expect(
				evaluateCondition(
					{
						op: "stringIn",
						left: "user.role",
						right: ["editor", "${user.role}"],
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false when no candidate matches", () => {
			expect(
				evaluateCondition(
					{
						op: "stringIn",
						left: "user.role",
						right: ["editor", "viewer"],
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("returns false when left is undefined", () => {
			expect(
				evaluateCondition(
					{
						op: "stringIn",
						left: "user.nope",
						right: ["x"],
					} as never,
					baseCtx,
				),
			).toBe(false);
		});
	});

	describe("stringStartsWith", () => {
		it("returns true on prefix match", () => {
			expect(
				evaluateCondition(
					{
						op: "stringStartsWith",
						left: "user.role",
						right: "ad",
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false on no prefix match", () => {
			expect(
				evaluateCondition(
					{
						op: "stringStartsWith",
						left: "user.role",
						right: "view",
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("returns false when left is null", () => {
			expect(
				evaluateCondition(
					{
						op: "stringStartsWith",
						left: "user.attributes.missing",
						right: "a",
					} as never,
					baseCtx,
				),
			).toBe(false);
		});
	});

	describe("numberLessThan", () => {
		it("returns true when left < right", () => {
			expect(
				evaluateCondition(
					{
						op: "numberLessThan",
						left: "user.attributes.count",
						right: 10,
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false when left === right (strict <)", () => {
			expect(
				evaluateCondition(
					{
						op: "numberLessThan",
						left: "user.attributes.count",
						right: 7,
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("returns false when left is not a number", () => {
			expect(
				evaluateCondition({ op: "numberLessThan", left: "user.role", right: 10 } as never, baseCtx),
			).toBe(false);
		});
	});

	describe("numberGreaterThan", () => {
		it("returns true when left > right", () => {
			expect(
				evaluateCondition(
					{
						op: "numberGreaterThan",
						left: "user.attributes.count",
						right: 5,
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false when left === right (strict >)", () => {
			expect(
				evaluateCondition(
					{
						op: "numberGreaterThan",
						left: "user.attributes.count",
						right: 7,
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("returns false when left is not a number", () => {
			expect(
				evaluateCondition(
					{ op: "numberGreaterThan", left: "user.role", right: 5 } as never,
					baseCtx,
				),
			).toBe(false);
		});
	});

	describe("bool", () => {
		it("returns true when boolean equals expected", () => {
			expect(
				evaluateCondition(
					{ op: "bool", left: "user.attributes.active", right: true } as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false when boolean does NOT match expected", () => {
			expect(
				evaluateCondition(
					{ op: "bool", left: "user.attributes.active", right: false } as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("returns false when left is not a boolean", () => {
			expect(
				evaluateCondition({ op: "bool", left: "user.role", right: true } as never, baseCtx),
			).toBe(false);
		});
	});

	describe("attributeExists", () => {
		it("returns true when attribute is present (truthy)", () => {
			expect(evaluateCondition({ op: "attributeExists", left: "user.id" } as never, baseCtx)).toBe(
				true,
			);
		});

		it("returns true when attribute is present and false (only undefined/null fail)", () => {
			expect(
				evaluateCondition(
					{ op: "attributeExists", left: "user.attributes.active" } as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("returns false for missing path (undefined)", () => {
			expect(
				evaluateCondition({ op: "attributeExists", left: "user.nonexistent" } as never, baseCtx),
			).toBe(false);
		});

		it("returns false for null value", () => {
			expect(
				evaluateCondition(
					{ op: "attributeExists", left: "user.attributes.missing" } as never,
					baseCtx,
				),
			).toBe(false);
		});
	});

	describe("not / anyOf / allOf", () => {
		it("not inverts a true condition to false", () => {
			expect(
				evaluateCondition(
					{
						op: "not",
						condition: {
							op: "stringEquals",
							left: "user.role",
							right: "admin",
						},
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("not inverts a false condition to true", () => {
			expect(
				evaluateCondition(
					{
						op: "not",
						condition: {
							op: "stringEquals",
							left: "user.role",
							right: "viewer",
						},
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("anyOf returns true if at least one passes", () => {
			expect(
				evaluateCondition(
					{
						op: "anyOf",
						conditions: [
							{ op: "stringEquals", left: "user.role", right: "viewer" },
							{ op: "stringEquals", left: "user.role", right: "admin" },
						],
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("anyOf returns false if all fail", () => {
			expect(
				evaluateCondition(
					{
						op: "anyOf",
						conditions: [
							{ op: "stringEquals", left: "user.role", right: "viewer" },
							{ op: "stringEquals", left: "user.role", right: "editor" },
						],
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("anyOf returns false for an empty conditions array", () => {
			expect(evaluateCondition({ op: "anyOf", conditions: [] } as never, baseCtx)).toBe(false);
		});

		it("allOf returns true when every condition passes", () => {
			expect(
				evaluateCondition(
					{
						op: "allOf",
						conditions: [
							{ op: "stringEquals", left: "user.role", right: "admin" },
							{ op: "attributeExists", left: "user.id" },
						],
					} as never,
					baseCtx,
				),
			).toBe(true);
		});

		it("allOf returns false when any condition fails", () => {
			expect(
				evaluateCondition(
					{
						op: "allOf",
						conditions: [
							{ op: "stringEquals", left: "user.role", right: "admin" },
							{ op: "stringEquals", left: "user.role", right: "viewer" },
						],
					} as never,
					baseCtx,
				),
			).toBe(false);
		});

		it("allOf returns true for an empty conditions array (vacuous truth)", () => {
			expect(evaluateCondition({ op: "allOf", conditions: [] } as never, baseCtx)).toBe(true);
		});
	});
});
