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

	it("author repository returns ok:false when the slug collides (catch branch)", () => {
		const db = makeDb();
		const { sqliteAuthorRepository } = createSqliteCatalogStore(() => db);

		expect(sqliteAuthorRepository.createAuthor({ name: "Ada Lovelace" }, actor).ok).toBe(true);
		// A second insert with the same name slugifies identically; the unique
		// constraint throws and the catch returns false, surfacing as ok:false.
		const dup = sqliteAuthorRepository.createAuthor({ name: "Ada Lovelace" }, actor);
		expect(dup.ok).toBe(false);
	});

	it("taxonomy repository returns ok:false when a category slug collides (catch branch)", () => {
		const db = makeDb();
		const { sqliteTaxonomyRepository } = createSqliteCatalogStore(() => db);

		expect(sqliteTaxonomyRepository.createCategory({ name: "Featured" }, actor).ok).toBe(true);
		const dup = sqliteTaxonomyRepository.createCategory({ name: "Featured" }, actor);
		expect(dup.ok).toBe(false);
	});

	it("author repository update + delete round-trip via id", () => {
		const db = makeDb();
		const { sqliteAuthorRepository } = createSqliteCatalogStore(() => db);

		expect(sqliteAuthorRepository.createAuthor({ name: "Original" }, actor).ok).toBe(true);
		const created = sqliteAuthorRepository.listAuthors()[0];
		expect(created).toBeDefined();
		if (!created) return;

		const upd = sqliteAuthorRepository.updateAuthor(
			{ id: created.id, slug: created.slug, name: "Renamed", bio: "Updated bio" },
			actor,
		);
		expect(upd.ok).toBe(true);
		expect(sqliteAuthorRepository.listAuthors()[0]?.name).toBe("Renamed");

		const del = sqliteAuthorRepository.deleteAuthor(created.id, actor);
		expect(del.ok).toBe(true);
		expect(sqliteAuthorRepository.listAuthors()).toHaveLength(0);
	});

	it("taxonomy repository creates a category that listCategories reads back", () => {
		const db = makeDb();
		const { sqliteTaxonomyRepository } = createSqliteCatalogStore(() => db);

		const result = sqliteTaxonomyRepository.createCategory({ name: "Announcements" }, actor);
		expect(result.ok).toBe(true);

		expect(sqliteTaxonomyRepository.listCategories().map((c) => c.name)).toContain("Announcements");
	});

	it("taxonomy repository creates, lists tags, and deletes them", () => {
		const db = makeDb();
		const { sqliteTaxonomyRepository } = createSqliteCatalogStore(() => db);

		expect(sqliteTaxonomyRepository.createTag({ name: "Featured" }, actor).ok).toBe(true);
		const tag = sqliteTaxonomyRepository.listTags()[0];
		expect(tag?.name).toBe("Featured");
		if (!tag) return;

		const del = sqliteTaxonomyRepository.deleteTag(tag.id, actor);
		expect(del.ok).toBe(true);
		expect(sqliteTaxonomyRepository.listTags()).toHaveLength(0);
	});
});
