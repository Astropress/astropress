import { describe, expect, it } from "vitest";
import {
	listSqliteContentRecords,
	type SqliteActor,
	type SqliteAdminRuntime,
	saveSqlitePageOrPost,
} from "../src/adapters/sqlite-helpers";

const actor: SqliteActor = { email: "a@b.test", role: "admin", name: "A" };

function buildRuntime(content: Record<string, unknown>): SqliteAdminRuntime {
	const empty = () => [];
	return {
		sqliteAdminStore: {
			content,
			redirects: { getRedirectRules: empty },
			comments: { getComments: empty },
			users: { listAdminUsers: empty },
			media: { listMediaAssets: empty },
			settings: { getSettings: () => ({ siteTitle: "" }) },
		},
	} as unknown as SqliteAdminRuntime;
}

describe("listSqliteContentRecords outer kind-filter guard (L21)", () => {
	it("does NOT touch content.listContentStates when kind is non-content", () => {
		let called = false;
		const runtime = buildRuntime({
			listContentStates: () => {
				called = true;
				throw new Error("listContentStates must not be called for kind=redirect");
			},
		});
		listSqliteContentRecords(runtime, (() => {}) as never, "redirect");
		expect(called).toBe(false);
	});

	it("DOES call content.listContentStates when kind is page", () => {
		let called = false;
		const runtime = buildRuntime({
			listContentStates: () => {
				called = true;
				return [];
			},
		});
		listSqliteContentRecords(runtime, (() => {}) as never, "page");
		expect(called).toBe(true);
	});
});

describe("saveSqlitePageOrPost throw guards", () => {
	it("throws result.error when saveContentState returns ok:false (L164 existing-branch guard)", () => {
		const runtime = buildRuntime({
			getContentState: () => ({ title: "x", body: "b", summary: "s" }),
			saveContentState: () => ({ ok: false, error: "SAVE_REJECTED_SENTINEL" }),
		});
		expect(() =>
			saveSqlitePageOrPost(
				runtime,
				"slug-x",
				{ id: "slug-x", kind: "page", slug: "slug-x", status: "published", title: "T" },
				actor,
			),
		).toThrow("SAVE_REJECTED_SENTINEL");
	});

	it("throws result.error when createContentRecord returns ok:false (L183 new-branch guard)", () => {
		const runtime = buildRuntime({
			getContentState: () => null,
			createContentRecord: () => ({ ok: false, error: "CREATE_REJECTED_SENTINEL" }),
		});
		expect(() =>
			saveSqlitePageOrPost(
				runtime,
				"slug-y",
				{ id: "slug-y", kind: "page", slug: "slug-y", status: "published", title: "T" },
				actor,
			),
		).toThrow("CREATE_REJECTED_SENTINEL");
	});
});
