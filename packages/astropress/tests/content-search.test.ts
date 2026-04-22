/**
 * Content search tests — verifies FTS5 virtual table creation, trigger-based sync,
 * and search query behavior.
 *
 * All tests run in-process using DatabaseSync with the real schema.
 */

import { describe, expect, it, vi } from "vitest";

import { searchContentOverrides } from "../src/sqlite-runtime/search.js";
import {
	ensureFts5SearchIndex,
	getTableSql,
} from "../src/sqlite-schema-compat.js";
import { makeDb } from "./helpers/make-db.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function setCmsConfig(search?: { enabled?: boolean }) {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[
		CMS_CONFIG_KEY
	] = {
		siteName: "Test Site",
		siteUrl: "https://example.com",
		templateKeys: [],
		seedPages: [],
		archives: [],
		translationStatus: [],
		search,
	};
}

function clearCmsConfig() {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[
		CMS_CONFIG_KEY
	] = null;
}

describe("FTS5 search index creation", () => {
	it("ensureFts5SearchIndex creates content_fts virtual table", () => {
		const db = makeDb();
		expect(getTableSql(db, "content_fts")).toBeUndefined();

		ensureFts5SearchIndex(db);

		// FTS5 virtual tables appear in sqlite_master as type 'table'
		const row = db
			.prepare("SELECT name FROM sqlite_master WHERE name = 'content_fts'")
			.get() as { name: string } | undefined;
		expect(row?.name).toBe("content_fts");
		db.close();
	});

	it("ensureFts5SearchIndex is idempotent — calling twice does not throw", () => {
		const db = makeDb();
		ensureFts5SearchIndex(db);
		expect(() => ensureFts5SearchIndex(db)).not.toThrow();
		db.close();
	});
});

describe("FTS5 search query", () => {
	it("returns a record whose body matches a unique phrase", () => {
		const db = makeDb();
		ensureFts5SearchIndex(db);

		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, updated_by, body)
       VALUES ('fts-test-post', 'FTS Test Post', 'published', 'admin@example.com', 'uniqueftstestphrase searchable content')`,
		).run();

		const results = searchContentOverrides(db, "uniqueftstestphrase");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].slug).toBe("fts-test-post");
		db.close();
	});

	it("returns updated content after an UPDATE trigger fires", () => {
		const db = makeDb();
		ensureFts5SearchIndex(db);

		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, updated_by, body)
       VALUES ('fts-update-test', 'Update Test', 'draft', 'admin@example.com', 'originalbodycontent')`,
		).run();

		// Update the body — the AFTER UPDATE trigger should sync the FTS index
		db.prepare(
			`UPDATE content_overrides SET body = 'replacedftsbodyphrase' WHERE slug = 'fts-update-test'`,
		).run();

		const results = searchContentOverrides(db, "replacedftsbodyphrase");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].slug).toBe("fts-update-test");

		// Original phrase should no longer match
		const oldResults = searchContentOverrides(db, "originalbodycontent");
		expect(oldResults).toHaveLength(0);
		db.close();
	});
});

describe("searchRuntimeContentStates gating", () => {
	it("returns empty array with a warning when search.enabled is false", async () => {
		setCmsConfig({ enabled: false });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Import after setting config to ensure peekCmsConfig resolves correctly
		const { searchRuntimeContentStates } = await import(
			"../src/runtime-page-store.js"
		);
		const results = await searchRuntimeContentStates("hello");

		expect(results).toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("search.enabled"),
		);
		warnSpy.mockRestore();
		clearCmsConfig();
	});
});
