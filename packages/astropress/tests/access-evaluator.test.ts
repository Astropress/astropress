import { describe, expect, test } from "vitest";
import type { BindingContext, Policy, Subject } from "../src/access";
import {
	actionMatches,
	createPolicyEngine,
	evaluate,
	evaluateCondition,
	resolvePath,
	substituteString,
} from "../src/access";

function subject(overrides: Partial<Subject> = {}): Subject {
	return {
		id: "u1",
		email: "u1@example.com",
		isAdmin: false,
		roles: [],
		attributes: {},
		...overrides,
	};
}

function rolePolicy(overrides: Partial<Policy> = {}): Policy {
	return {
		id: "p1",
		effect: "allow",
		action: "posts:edit",
		priority: 0,
		source: { kind: "role", roleId: "r1", roleName: "Editor" },
		...overrides,
	};
}

describe("actionMatches", () => {
	test("exact match", () => {
		expect(actionMatches("posts:edit", "posts:edit")).toBe(true);
		expect(actionMatches("posts:edit", "posts:delete")).toBe(false);
	});
	test("namespace wildcard", () => {
		expect(actionMatches("posts:*", "posts:edit")).toBe(true);
		expect(actionMatches("posts:*", "pages:edit")).toBe(false);
	});
	test("global wildcard", () => {
		expect(actionMatches("*", "anything:goes")).toBe(true);
	});
});

describe("resolvePath", () => {
	const ctx: BindingContext = {
		user: subject({ attributes: { team: "alpha" } }),
		resource: { type: "post", ownerId: "u1", attributes: { tier: 2 } },
		env: { mfaUsed: true },
	};
	test("resolves direct fields", () => {
		expect(resolvePath("user.id", ctx)).toBe("u1");
		expect(resolvePath("resource.ownerId", ctx)).toBe("u1");
		expect(resolvePath("env.mfaUsed", ctx)).toBe(true);
	});
	test("resolves attribute submap", () => {
		expect(resolvePath("user.attributes.team", ctx)).toBe("alpha");
		expect(resolvePath("resource.attributes.tier", ctx)).toBe(2);
	});
	test("missing path returns undefined", () => {
		expect(resolvePath("user.attributes.missing", ctx)).toBeUndefined();
		expect(resolvePath("nonexistent.x", ctx)).toBeUndefined();
	});
});

describe("substituteString", () => {
	test("replaces ${path} tokens", () => {
		const ctx: BindingContext = { user: subject({ id: "abc" }) };
		expect(substituteString("owner-${user.id}", ctx)).toBe("owner-abc");
	});
	test("missing values become empty", () => {
		const ctx: BindingContext = { user: subject() };
		expect(substituteString("x-${user.attributes.team}-y", ctx)).toBe("x--y");
	});
});

describe("evaluateCondition", () => {
	const ctx: BindingContext = {
		user: subject({ id: "u1", attributes: { team: "alpha" } }),
		resource: { type: "post", ownerId: "u1" },
	};

	test("stringEquals with substitution", () => {
		expect(
			evaluateCondition({ op: "stringEquals", left: "resource.ownerId", right: "${user.id}" }, ctx),
		).toBe(true);
	});
	test("stringIn", () => {
		expect(
			evaluateCondition(
				{
					op: "stringIn",
					left: "user.attributes.team",
					right: ["alpha", "beta"],
				},
				ctx,
			),
		).toBe(true);
	});
	test("not + anyOf + allOf compose", () => {
		expect(
			evaluateCondition(
				{
					op: "not",
					condition: {
						op: "anyOf",
						conditions: [
							{ op: "stringEquals", left: "user.id", right: "u9" },
							{ op: "bool", left: "user.isAdmin", right: true },
						],
					},
				},
				ctx,
			),
		).toBe(true);
	});
	test("missing left fails by default", () => {
		expect(
			evaluateCondition({ op: "stringEquals", left: "user.attributes.missing", right: "x" }, ctx),
		).toBe(false);
	});
});

describe("evaluate", () => {
	test("admin bypasses everything", () => {
		const r = evaluate(subject({ isAdmin: true }), "anything:goes", []);
		expect(r.decision).toBe("allow");
		expect(r.reason).toContain("Admin");
	});

	test("no matching policy → deny by default", () => {
		const r = evaluate(subject(), "posts:edit", []);
		expect(r.decision).toBe("deny");
		expect(r.reason).toContain("Default is deny");
	});

	test("matching allow grants", () => {
		const r = evaluate(subject(), "posts:edit", [rolePolicy()]);
		expect(r.decision).toBe("allow");
		expect(r.matchedPolicy?.id).toBe("p1");
	});

	test("DENY beats ALLOW regardless of priority", () => {
		const r = evaluate(subject(), "posts:edit", [
			rolePolicy({ id: "allow1", effect: "allow", priority: 100 }),
			rolePolicy({ id: "deny1", effect: "deny", priority: 1 }),
		]);
		expect(r.decision).toBe("deny");
		expect(r.matchedPolicy?.id).toBe("deny1");
	});

	test("condition gates policy applicability", () => {
		const subj = subject({ id: "u1" });
		const ownerOnly = rolePolicy({
			condition: {
				op: "stringEquals",
				left: "resource.ownerId",
				right: "${user.id}",
			},
		});
		const ownResource = { type: "post", ownerId: "u1" };
		const otherResource = { type: "post", ownerId: "u9" };

		expect(evaluate(subj, "posts:edit", [ownerOnly], ownResource).decision).toBe("allow");
		expect(evaluate(subj, "posts:edit", [ownerOnly], otherResource).decision).toBe("deny");
	});

	test("namespace wildcard policy matches sub-actions", () => {
		const r = evaluate(subject(), "posts:delete", [rolePolicy({ action: "posts:*" })]);
		expect(r.decision).toBe("allow");
	});

	test("highest-priority allow is reported when multiple allow", () => {
		const r = evaluate(subject(), "posts:edit", [
			rolePolicy({ id: "low", priority: 1 }),
			rolePolicy({ id: "high", priority: 10 }),
		]);
		expect(r.matchedPolicy?.id).toBe("high");
	});
});

describe("createPolicyEngine", () => {
	test("delegates to evaluate with loader-supplied policies", () => {
		const policies = [rolePolicy()];
		const engine = createPolicyEngine({
			resolvePoliciesForSubject: () => policies,
		});
		const r = engine.can(subject(), "posts:edit");
		expect(r.decision).toBe("allow");
	});

	test("policiesFor returns the resolved set", () => {
		const policies = [rolePolicy()];
		const engine = createPolicyEngine({
			resolvePoliciesForSubject: () => policies,
		});
		expect(engine.policiesFor(subject())).toBe(policies);
	});
});
