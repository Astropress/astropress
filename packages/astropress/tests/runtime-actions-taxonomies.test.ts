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
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

interface AuditRow {
	action: string;
	resource_type: string;
	resource_id: string;
	summary: string;
}

function latestAudit(): AuditRow | undefined {
	return db
		.prepare(
			"SELECT action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
		)
		.get() as AuditRow | undefined;
}

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
	db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)").run("Existing Tag", "existing-tag");
});

describe("createRuntimeAuthor", () => {
	it("creates an author and records audit with trimmed summary", async () => {
		const result = await createRuntimeAuthor({ name: "  New Author  " }, actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT name FROM authors WHERE slug = 'new-author'").get() as
			| { name: string }
			| undefined;
		expect(row?.name).toBe("New Author");
		expect(latestAudit()).toMatchObject({
			action: "author.create",
			resource_type: "content",
			resource_id: "  New Author  ",
			summary: "Created author New Author.",
		});
	});

	it("uses input.slug as resource_id when provided (?? left branch)", async () => {
		await createRuntimeAuthor({ name: "Display", slug: "explicit-slug" }, actor, locals);
		expect(latestAudit()?.resource_id).toBe("explicit-slug");
	});

	it("rejects duplicate slug and skips audit", async () => {
		const result = await createRuntimeAuthor({ name: "Existing Author" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});

	it("rejects empty name and skips audit", async () => {
		const result = await createRuntimeAuthor({ name: "   " }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("updateRuntimeAuthor", () => {
	it("updates name and bio and records audit", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)")
			.run("Old", "old-author");
		const result = await updateRuntimeAuthor(
			{ id: Number(id), name: "  New Name  ", bio: "New bio" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT name, bio FROM authors WHERE id = ?").get(Number(id)) as {
			name: string;
			bio: string;
		};
		expect(row.name).toBe("New Name");
		expect(latestAudit()).toMatchObject({
			action: "author.update",
			resource_type: "content",
			resource_id: String(id),
			summary: "Updated author New Name.",
		});
	});

	it("rejects empty name and skips audit", async () => {
		const result = await updateRuntimeAuthor({ id: 1, name: "  " }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("deleteRuntimeAuthor", () => {
	it("soft-deletes an author and records audit unconditionally", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)")
			.run("To Delete", "to-delete");
		const result = await deleteRuntimeAuthor(Number(id), actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM authors WHERE id = ?").get(Number(id)) as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
		expect(latestAudit()).toMatchObject({
			action: "author.delete",
			resource_type: "content",
			resource_id: String(id),
			summary: `Deleted author ${id}.`,
		});
	});
});

describe("createRuntimeCategory", () => {
	it("creates a category and records audit with trimmed summary", async () => {
		const result = await createRuntimeCategory({ name: "  New Cat  " }, actor, locals);
		expect(result).toMatchObject({ ok: true });
		expect(latestAudit()).toMatchObject({
			action: "category.create",
			resource_type: "content",
			resource_id: "  New Cat  ",
			summary: "Created category New Cat.",
		});
	});

	it("uses input.slug as resource_id when provided (?? left branch)", async () => {
		await createRuntimeCategory({ name: "Some Cat", slug: "explicit-cat-slug" }, actor, locals);
		expect(latestAudit()?.resource_id).toBe("explicit-cat-slug");
	});

	it("rejects duplicate slug and skips audit", async () => {
		const result = await createRuntimeCategory({ name: "Existing Cat" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("updateRuntimeCategory", () => {
	it("updates a category and records audit", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
			.run("Old Cat", "old-cat");
		const result = await updateRuntimeCategory(
			{ id: Number(id), name: "  Updated Cat  " },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		expect(latestAudit()).toMatchObject({
			action: "category.update",
			resource_id: String(id),
			summary: "Updated category Updated Cat.",
		});
	});

	it("returns not-ok for invalid id (0) and skips audit", async () => {
		const result = await updateRuntimeCategory({ id: 0, name: "Invalid" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("deleteRuntimeCategory", () => {
	it("soft-deletes a category and records audit", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
			.run("Delete Cat", "delete-cat");
		const result = await deleteRuntimeCategory(Number(id), actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM categories WHERE id = ?").get(Number(id)) as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
		expect(latestAudit()).toMatchObject({
			action: "category.delete",
			resource_id: String(id),
			summary: `Deleted category ${id}.`,
		});
	});
});

describe("createRuntimeTag", () => {
	it("creates a tag and records audit with trimmed summary", async () => {
		const result = await createRuntimeTag({ name: "  New Tag  " }, actor, locals);
		expect(result).toMatchObject({ ok: true });
		expect(latestAudit()).toMatchObject({
			action: "tag.create",
			resource_type: "content",
			resource_id: "  New Tag  ",
			summary: "Created tag New Tag.",
		});
	});

	it("uses input.slug as resource_id when provided (?? left branch)", async () => {
		await createRuntimeTag({ name: "Some Tag", slug: "explicit-tag-slug" }, actor, locals);
		expect(latestAudit()?.resource_id).toBe("explicit-tag-slug");
	});

	it("rejects duplicate slug and skips audit", async () => {
		const result = await createRuntimeTag({ name: "Existing Tag" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("updateRuntimeTag", () => {
	it("updates a tag and records audit", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)")
			.run("Old Tag", "old-tag");
		const result = await updateRuntimeTag(
			{ id: Number(id), name: "  Updated Tag  " },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		expect(latestAudit()).toMatchObject({
			action: "tag.update",
			resource_id: String(id),
			summary: "Updated tag Updated Tag.",
		});
	});

	it("returns not-ok for invalid id (0) and skips audit", async () => {
		const result = await updateRuntimeTag({ id: 0, name: "Invalid" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit()).toBeUndefined();
	});
});

describe("deleteRuntimeTag", () => {
	it("soft-deletes a tag and records audit", async () => {
		const { lastInsertRowid: id } = db
			.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)")
			.run("Delete Tag", "delete-tag");
		const result = await deleteRuntimeTag(Number(id), actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM tags WHERE id = ?").get(Number(id)) as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
		expect(latestAudit()).toMatchObject({
			action: "tag.delete",
			resource_id: String(id),
			summary: `Deleted tag ${id}.`,
		});
	});
});
