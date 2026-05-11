import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AccessSnapshot } from "../src/access/d1-access-store";
import { getAccessContext } from "../src/access/request-context";

let mockD1Result: AccessSnapshot | null = null;

vi.mock("../src/access/d1-access-store", () => ({
	loadAccessSnapshotFromD1: vi.fn(async () => mockD1Result),
}));

function makeD1Locals(adminUser: { email: string; isAdmin: boolean; id?: string }) {
	const fakeDb = {
		prepare: () => ({ bind: () => ({ first: async () => null, all: async () => [] }) }),
	};
	return {
		adminUser,
		runtime: { env: { DB: fakeDb } },
	} as unknown as App.Locals;
}

describe("getAccessContext — D1 branch (kill NoCoverage mutants)", () => {
	beforeEach(() => {
		mockD1Result = null;
	});

	test("uses the D1 snapshot when loadAccessSnapshotFromD1 returns a non-null result", async () => {
		mockD1Result = {
			userId: "u-42",
			isAdmin: false,
			roles: ["editor"],
			attributes: { dept: "eng" },
			policies: [
				{
					id: "p1",
					effect: "allow",
					action: "media:upload",
					source: { kind: "direct" },
				},
			],
		};
		const ctx = await getAccessContext({
			locals: makeD1Locals({ email: "u@example.com", isAdmin: false }),
		});
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.id).toBe("u-42");
		expect(ctx.subject.roles).toEqual(["editor"]);
		expect(ctx.subject.attributes).toEqual({ dept: "eng" });
		expect(ctx.subject.isAdmin).toBe(false);
		expect(ctx.can("media:upload").decision).toBe("allow");
	});

	test("the D1 snapshot OR-combines with isAuthUserAdmin (auth flag wins over stale is_admin column)", async () => {
		mockD1Result = {
			userId: "u-1",
			isAdmin: false,
			roles: [],
			attributes: {},
			policies: [],
		};
		const ctx = await getAccessContext({
			locals: makeD1Locals({ email: "a@example.com", isAdmin: true }),
		});
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.isAdmin).toBe(true);
	});

	test("the D1 snapshot keeps isAdmin true when the DB already says is_admin = 1", async () => {
		mockD1Result = {
			userId: "u-2",
			isAdmin: true,
			roles: [],
			attributes: {},
			policies: [],
		};
		const ctx = await getAccessContext({
			locals: makeD1Locals({ email: "a@example.com", isAdmin: false }),
		});
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.isAdmin).toBe(true);
	});

	test("falls back to admin-only snapshot when D1 returns null (kills adminOnlySnapshot NoCoverage)", async () => {
		mockD1Result = null;
		const ctx = await getAccessContext({
			locals: makeD1Locals({ email: "missing@example.com", isAdmin: true }),
		});
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.id).toBe("email:missing@example.com");
		expect(ctx.subject.isAdmin).toBe(true);
		expect(ctx.subject.roles).toEqual([]);
		expect(ctx.subject.attributes).toEqual({});
	});

	test("admin-only fallback uses adminUser.id when present (pins ?? operand order)", async () => {
		mockD1Result = null;
		const locals = {
			adminUser: { id: "id-explicit", email: "x@example.com", isAdmin: true },
			runtime: { env: { DB: { prepare: () => ({}) } } },
		} as unknown as App.Locals;
		const ctx = await getAccessContext({ locals });
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.id).toBe("id-explicit");
	});

	test("admin-only fallback (non-admin user, D1 returns null) emits empty roles/policies", async () => {
		mockD1Result = null;
		const locals = {
			adminUser: { email: "editor@example.com", isAdmin: false },
			runtime: { env: { DB: { prepare: () => ({}) } } },
		} as unknown as App.Locals;
		const ctx = await getAccessContext({ locals });
		if (!ctx) throw new Error("expected ctx");
		expect(ctx.subject.isAdmin).toBe(false);
		// Non-admin with empty policies → can() denies arbitrary actions
		expect(ctx.can("media:upload").decision).toBe("deny");
	});
});
