import { describe, expect, it } from "vitest";

import type { Actor } from "../../src/persistence-types.js";
import { createSqliteCatalogStore } from "../../src/sqlite-runtime/catalog.js";
import { makeDb } from "../helpers/make-db.js";

const actor: Actor = { email: "admin@example.com", role: "admin", name: "Admin" };

describe("createSqliteCatalogStore", () => {
	it("author repository creates a row that listAuthors reads back", () => {
		const db = makeDb();
		const { sqliteAuthorRepository } = createSqliteCatalogStore(() => db);

		const result = sqliteAuthorRepository.createAuthor({ name: "Ada Lovelace" }, actor);
		expect(result.ok).toBe(true);

		expect(sqliteAuthorRepository.listAuthors().map((a) => a.name)).toContain("Ada Lovelace");
	});

	it("taxonomy repository creates a category that listCategories reads back", () => {
		const db = makeDb();
		const { sqliteTaxonomyRepository } = createSqliteCatalogStore(() => db);

		const result = sqliteTaxonomyRepository.createCategory({ name: "Announcements" }, actor);
		expect(result.ok).toBe(true);

		expect(sqliteTaxonomyRepository.listCategories().map((c) => c.name)).toContain("Announcements");
	});
});
