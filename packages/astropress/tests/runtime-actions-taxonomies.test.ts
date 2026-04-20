import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import {
	createRuntimeAuthor,
	createRuntimeCategory,
	createRuntimeTag,
	deleteRuntimeAuthor,
	deleteRuntimeCategory,
	deleteRuntimeTag,
	updateRuntimeAuthor,
	updateRuntimeCategory,
	updateRuntimeTag,
} from "../src/runtime-actions-taxonomies";
import {
	STANDARD_ACTOR,
	STANDARD_CMS_CONFIG,
	makeDb,
} from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);

	db.prepare("INSERT INTO authors (name, slug, bio) VALUES (?, ?, ?)").run(
		"Existing Author",
		"existing-author",
		"Bio",
	);
	db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run(
		"Existing Cat",
		"existing-cat",
	);
	db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)").run(
		"Existing Tag",
		"existing-tag",
	);
});

describe("createRuntimeAuthor", () => {
	it("creates an author", async () => {
		const result = await createRuntimeAuthor(
			{ name: "New Author" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT name FROM authors WHERE slug = 'new-author'")
			.get() as { name: string } | undefined;
		expect(row?.name).toBe("New Author");
	});

	it("rejects duplicate slug", async () => {
		const result = await createRuntimeAuthor(
			{ name: "Existing Author" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects empty name", async () => {
		const result = await createRuntimeAuthor({ name: "   " }, actor, locals);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("updateRuntimeAuthor", () => {
	it("updates name and bio", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)")
			.run("Old", "old-author");
		const result = await updateRuntimeAuthor(
			{ id: Number(id), name: "New Name", bio: "New bio" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT name, bio FROM authors WHERE id = ?")
			.get(Number(id)) as { name: string; bio: string };
		expect(row.name).toBe("New Name");
	});

	it("rejects empty name", async () => {
		const result = await updateRuntimeAuthor(
			{ id: 1, name: "  " },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("deleteRuntimeAuthor", () => {
	it("soft-deletes an author", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)")
			.run("To Delete", "to-delete");
		const result = await deleteRuntimeAuthor(Number(id), actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT deleted_at FROM authors WHERE id = ?")
			.get(Number(id)) as { deleted_at: string | null };
		expect(row.deleted_at).not.toBeNull();
	});
});

describe("createRuntimeCategory", () => {
	it("creates a category", async () => {
		const result = await createRuntimeCategory(
			{ name: "New Cat" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("rejects duplicate slug", async () => {
		const result = await createRuntimeCategory(
			{ name: "Existing Cat" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("updateRuntimeCategory", () => {
	it("updates a category", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
			.run("Old Cat", "old-cat");
		const result = await updateRuntimeCategory(
			{ id: Number(id), name: "Updated Cat" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("returns not-ok for invalid id (0)", async () => {
		const result = await updateRuntimeCategory(
			{ id: 0, name: "Invalid" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("deleteRuntimeCategory", () => {
	it("soft-deletes a category", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
			.run("Delete Cat", "delete-cat");
		await deleteRuntimeCategory(Number(id), actor, locals);
		const row = db
			.prepare("SELECT deleted_at FROM categories WHERE id = ?")
			.get(Number(id)) as { deleted_at: string | null };
		expect(row.deleted_at).not.toBeNull();
	});
});

describe("createRuntimeTag", () => {
	it("creates a tag", async () => {
		const result = await createRuntimeTag({ name: "New Tag" }, actor, locals);
		expect(result).toMatchObject({ ok: true });
	});

	it("rejects duplicate slug", async () => {
		const result = await createRuntimeTag(
			{ name: "Existing Tag" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("updateRuntimeTag", () => {
	it("updates a tag", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)")
			.run("Old Tag", "old-tag");
		const result = await updateRuntimeTag(
			{ id: Number(id), name: "Updated Tag" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("returns not-ok for invalid id (0)", async () => {
		const result = await updateRuntimeTag(
			{ id: 0, name: "Invalid" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("deleteRuntimeTag", () => {
	it("soft-deletes a tag", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)")
			.run("Delete Tag", "delete-tag");
		await deleteRuntimeTag(Number(id), actor, locals);
		const row = db
			.prepare("SELECT deleted_at FROM tags WHERE id = ?")
			.get(Number(id)) as { deleted_at: string | null };
		expect(row.deleted_at).not.toBeNull();
	});
});
