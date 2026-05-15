// Direct mutation-coverage tests for d1-store-taxonomies.ts.
// The store factories are exercised end-to-end through the
// SqliteBackedD1Database fixture so insert/select/error paths and the
// exact error-string returns are all observable.
import { beforeEach, describe, expect, it } from "vitest";

import {
	createD1AuthorsMutationPart,
	createD1AuthorsReadPart,
	createD1TaxonomiesMutationPart,
	createD1TaxonomiesReadPart,
} from "../src/d1-store-taxonomies";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

let d1: SqliteBackedD1Database;
let db: ReturnType<typeof makeDb>;

beforeEach(() => {
	db = makeDb();
	d1 = new SqliteBackedD1Database(db);
});

describe("createD1AuthorsReadPart.listAuthors", () => {
	it("maps every column and orders by name COLLATE NOCASE", async () => {
		db.prepare("INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)").run("b", "bob", "B-bio");
		db.prepare("INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)").run(
			"a",
			"Alice",
			null as unknown as string,
		);
		const result = await createD1AuthorsReadPart(d1).listAuthors();
		expect(result.map((r) => r.name)).toEqual(["Alice", "bob"]);
		const alice = result[0];
		expect(alice).toMatchObject({ slug: "a", name: "Alice" });
		expect(alice.bio).toBeUndefined();
		expect(typeof alice.createdAt).toBe("string");
		expect(typeof alice.updatedAt).toBe("string");
		expect(typeof alice.id).toBe("number");
		const bob = result[1];
		expect(bob.bio).toBe("B-bio");
	});

	it("filters out soft-deleted authors", async () => {
		db.prepare(
			"INSERT INTO authors (slug, name, bio, deleted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		).run("d", "Deleted", null as unknown as string);
		db.prepare("INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)").run("k", "Keep", null);
		const result = await createD1AuthorsReadPart(d1).listAuthors();
		expect(result.map((r) => r.name)).toEqual(["Keep"]);
	});
});

describe("createD1TaxonomiesReadPart.listCategories / listTags", () => {
	it("listCategories maps every column with kind='category' and orders by name", async () => {
		db.prepare("INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)").run(
			"b",
			"News",
			"latest",
		);
		db.prepare("INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)").run(
			"a",
			"Archives",
			null as unknown as string,
		);
		const result = await createD1TaxonomiesReadPart(d1).listCategories();
		expect(result.map((r) => r.name)).toEqual(["Archives", "News"]);
		expect(result.every((r) => r.kind === "category")).toBe(true);
		expect(result[0].description).toBeUndefined();
		expect(result[1].description).toBe("latest");
	});

	it("listCategories filters out soft-deleted rows", async () => {
		db.prepare(
			"INSERT INTO categories (slug, name, description, deleted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		).run("d", "Deleted", null as unknown as string);
		db.prepare("INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)").run(
			"k",
			"Keep",
			null as unknown as string,
		);
		const result = await createD1TaxonomiesReadPart(d1).listCategories();
		expect(result.map((r) => r.name)).toEqual(["Keep"]);
	});

	it("listTags maps every column with kind='tag' and orders by name", async () => {
		db.prepare("INSERT INTO tags (slug, name, description) VALUES (?, ?, ?)").run(
			"b",
			"Beta",
			"two",
		);
		db.prepare("INSERT INTO tags (slug, name, description) VALUES (?, ?, ?)").run(
			"a",
			"Alpha",
			null as unknown as string,
		);
		const result = await createD1TaxonomiesReadPart(d1).listTags();
		expect(result.map((r) => r.name)).toEqual(["Alpha", "Beta"]);
		expect(result.every((r) => r.kind === "tag")).toBe(true);
		expect(result[0].description).toBeUndefined();
		expect(result[1].description).toBe("two");
	});

	it("listTags filters out soft-deleted rows", async () => {
		db.prepare(
			"INSERT INTO tags (slug, name, description, deleted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		).run("d", "Deleted", null as unknown as string);
		db.prepare("INSERT INTO tags (slug, name, description) VALUES (?, ?, ?)").run(
			"k",
			"Keep",
			null as unknown as string,
		);
		const result = await createD1TaxonomiesReadPart(d1).listTags();
		expect(result.map((r) => r.name)).toEqual(["Keep"]);
	});
});

describe("createD1AuthorsMutationPart.createAuthor", () => {
	it("inserts a row when given a name and explicit slug, trimming bio", async () => {
		const result = await createD1AuthorsMutationPart(d1).createAuthor({
			name: "Author Name",
			slug: "custom-slug",
			bio: "  trimmed  ",
		});
		expect(result).toEqual({ ok: true });
		const row = db
			.prepare("SELECT slug, name, bio FROM authors WHERE name = 'Author Name'")
			.get() as { slug: string; name: string; bio: string };
		expect(row.slug).toBe("custom-slug");
		expect(row.bio).toBe("trimmed");
	});

	it("falls back to slugifying the name when slug is missing", async () => {
		const result = await createD1AuthorsMutationPart(d1).createAuthor({
			name: "  Bob Smith  ",
		});
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT slug, name FROM authors WHERE name = 'Bob Smith'").get() as {
			slug: string;
			name: string;
		};
		expect(row.slug).toBe("bob-smith");
	});

	it("returns the exact 'name and slug required' error for a blank name", async () => {
		const result = await createD1AuthorsMutationPart(d1).createAuthor({ name: "   " });
		expect(result).toEqual({ ok: false, error: "Author name and slug are required." });
	});

	it("returns the exact 'name or slug already in use' error on UNIQUE conflict", async () => {
		await createD1AuthorsMutationPart(d1).createAuthor({ name: "Dup", slug: "dup" });
		const result = await createD1AuthorsMutationPart(d1).createAuthor({ name: "Dup", slug: "dup" });
		expect(result).toEqual({ ok: false, error: "That author name or slug is already in use." });
	});

	it("stores an empty string when bio is omitted (not undefined)", async () => {
		await createD1AuthorsMutationPart(d1).createAuthor({ name: "NoBio", slug: "nobio" });
		const row = db.prepare("SELECT bio FROM authors WHERE name = 'NoBio'").get() as {
			bio: string | null;
		};
		expect(row.bio).toBe("");
	});
});

describe("createD1AuthorsMutationPart.updateAuthor", () => {
	beforeEach(() => {
		db.prepare("INSERT INTO authors (id, slug, name, bio) VALUES (?, ?, ?, ?)").run(
			1,
			"x",
			"X",
			"old",
		);
	});

	it("updates name, slug and trimmed bio for an active author", async () => {
		const result = await createD1AuthorsMutationPart(d1).updateAuthor({
			id: 1,
			name: "Renamed",
			slug: "renamed-slug",
			bio: "  new  ",
		});
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT slug, name, bio FROM authors WHERE id = 1").get() as {
			slug: string;
			name: string;
			bio: string;
		};
		expect(row).toEqual({ slug: "renamed-slug", name: "Renamed", bio: "new" });
	});

	it("returns the exact 'id, name, and slug required' error when id is missing", async () => {
		const result = await createD1AuthorsMutationPart(d1).updateAuthor({
			id: 0,
			name: "X",
			slug: "x",
		});
		expect(result).toEqual({ ok: false, error: "Author id, name, and slug are required." });
	});

	it("returns the exact 'id, name, and slug required' error when name is blank", async () => {
		const result = await createD1AuthorsMutationPart(d1).updateAuthor({
			id: 1,
			name: "   ",
		});
		expect(result).toEqual({ ok: false, error: "Author id, name, and slug are required." });
	});

	it("returns the exact 'name or slug already in use' error on UNIQUE conflict", async () => {
		db.prepare("INSERT INTO authors (id, slug, name) VALUES (?, ?, ?)").run(2, "taken", "Taken");
		const result = await createD1AuthorsMutationPart(d1).updateAuthor({
			id: 1,
			name: "Taken",
			slug: "taken",
		});
		expect(result).toEqual({ ok: false, error: "That author name or slug is already in use." });
	});

	it("stores an empty bio (not 'undefined' or a thrown TypeError) when bio is omitted", async () => {
		// Pins `input.bio?.trim() ?? ""` — both the optional chain and the `?? ""` fallback.
		const result = await createD1AuthorsMutationPart(d1).updateAuthor({
			id: 1,
			name: "NoBio",
			slug: "nobio",
		});
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT bio FROM authors WHERE id = 1").get() as { bio: string };
		expect(row.bio).toBe("");
	});
});

describe("createD1AuthorsMutationPart.deleteAuthor", () => {
	it("soft-deletes an author by setting deleted_at", async () => {
		db.prepare("INSERT INTO authors (id, slug, name) VALUES (?, ?, ?)").run(7, "g", "Gone");
		const result = await createD1AuthorsMutationPart(d1).deleteAuthor(7);
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM authors WHERE id = 7").get() as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
	});
});

describe("createD1TaxonomiesMutationPart — categories", () => {
	const part = () => createD1TaxonomiesMutationPart(d1);

	it("createCategory inserts and trims description", async () => {
		const result = await part().createCategory({
			name: "News",
			slug: "news",
			description: "  desc  ",
		});
		expect(result).toEqual({ ok: true });
		const row = db
			.prepare("SELECT slug, name, description FROM categories WHERE slug = 'news'")
			.get() as { slug: string; name: string; description: string };
		expect(row).toEqual({ slug: "news", name: "News", description: "desc" });
	});

	it("createCategory rejects with category-specific error message for blank name", async () => {
		const result = await part().createCategory({ name: "   " });
		expect(result).toEqual({ ok: false, error: "category name and slug are required." });
	});

	it("createCategory rejects with category-specific error on UNIQUE conflict", async () => {
		await part().createCategory({ name: "Dup", slug: "dup" });
		const result = await part().createCategory({ name: "Dup", slug: "dup" });
		expect(result).toEqual({
			ok: false,
			error: "That category name or slug is already in use.",
		});
	});

	it("createCategory stores an empty description when omitted", async () => {
		await part().createCategory({ name: "NoDesc", slug: "nodesc" });
		const row = db.prepare("SELECT description FROM categories WHERE slug = 'nodesc'").get() as {
			description: string | null;
		};
		expect(row.description).toBe("");
	});

	it("updateCategory rejects with category-specific error when id is missing", async () => {
		const result = await part().updateCategory({ id: 0, name: "X" });
		expect(result).toEqual({ ok: false, error: "category id, name, and slug are required." });
	});

	it("updateCategory updates an existing row", async () => {
		db.prepare("INSERT INTO categories (id, slug, name) VALUES (?, ?, ?)").run(1, "x", "X");
		const result = await part().updateCategory({ id: 1, name: "Renamed", slug: "renamed" });
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT slug, name FROM categories WHERE id = 1").get() as {
			slug: string;
			name: string;
		};
		expect(row).toEqual({ slug: "renamed", name: "Renamed" });
	});

	it("deleteCategory soft-deletes the row", async () => {
		db.prepare("INSERT INTO categories (id, slug, name) VALUES (?, ?, ?)").run(1, "x", "X");
		const result = await part().deleteCategory(1);
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM categories WHERE id = 1").get() as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
	});
});

describe("createD1TaxonomiesMutationPart — tags", () => {
	const part = () => createD1TaxonomiesMutationPart(d1);

	it("createTag inserts and uses tag-specific error wording on blank name", async () => {
		const ok = await part().createTag({ name: "T1", slug: "t1" });
		expect(ok).toEqual({ ok: true });
		const blank = await part().createTag({ name: "   " });
		expect(blank).toEqual({ ok: false, error: "tag name and slug are required." });
	});

	it("createTag uses tag-specific error wording on UNIQUE conflict", async () => {
		await part().createTag({ name: "Dup", slug: "dup" });
		const result = await part().createTag({ name: "Dup", slug: "dup" });
		expect(result).toEqual({ ok: false, error: "That tag name or slug is already in use." });
	});

	it("updateTag uses tag-specific error wording when id is missing", async () => {
		const result = await part().updateTag({ id: 0, name: "X" });
		expect(result).toEqual({ ok: false, error: "tag id, name, and slug are required." });
	});

	it("updateTag updates an existing row", async () => {
		db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").run(1, "x", "X");
		const result = await part().updateTag({ id: 1, name: "Renamed", slug: "renamed" });
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT slug, name FROM tags WHERE id = 1").get() as {
			slug: string;
			name: string;
		};
		expect(row).toEqual({ slug: "renamed", name: "Renamed" });
	});

	it("deleteTag soft-deletes the row", async () => {
		db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").run(1, "x", "X");
		const result = await part().deleteTag(1);
		expect(result).toEqual({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM tags WHERE id = 1").get() as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
	});
});
