import { readFileSync } from "node:fs";
import path from "node:path";
// @ts-nocheck
//
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

import { validateContentFields } from "../src/content-modeling.js";
import type {
	ContentTypeDefinition,
	FieldDefinition,
} from "../src/content-modeling.js";
import { createSqliteContentStore } from "../src/sqlite-runtime/content.js";
import { makeDb } from "./helpers/make-db.js";

// ─── FieldDefinition new types — structural ───────────────────────────────────

describe("FieldDefinition — new types (structural)", () => {
	it("accepts content-ref type", () => {
		const field: FieldDefinition = {
			name: "relatedPost",
			label: "Related Post",
			type: "content-ref",
			refKind: "post",
		};
		expect(field.type).toBe("content-ref");
		expect(field.refKind).toBe("post");
	});

	it("accepts repeater type with nested fields", () => {
		const field: FieldDefinition = {
			name: "links",
			label: "Links",
			type: "repeater",
			fields: [
				{ name: "href", label: "URL", type: "url", required: true },
				{ name: "label", label: "Label", type: "text" },
			],
		};
		expect(field.type).toBe("repeater");
		expect(field.fields).toHaveLength(2);
	});

	it("accepts conditionalOn visibility rule", () => {
		const field: FieldDefinition = {
			name: "calloutText",
			label: "Callout Text",
			type: "text",
			conditionalOn: { field: "showCallout", equals: true },
		};
		expect(field.conditionalOn?.field).toBe("showCallout");
		expect(field.conditionalOn?.equals).toBe(true);
	});
});

// ─── validateContentFields — content-ref ─────────────────────────────────────

describe("validateContentFields — content-ref type", () => {
	const contentType: ContentTypeDefinition = {
		key: "article",
		label: "Article",
		fields: [
			{ name: "relatedPost", label: "Related Post", type: "content-ref" },
		],
	};

	it("passes when value is a string slug", () => {
		expect(
			validateContentFields(contentType, { relatedPost: "my-post" }),
		).toBeNull();
	});

	it("fails when value is a number (not a slug string)", () => {
		const error = validateContentFields(contentType, { relatedPost: 42 });
		expect(error).toContain("must be a content slug string");
	});

	it("passes when field is not required and empty", () => {
		expect(validateContentFields(contentType, {})).toBeNull();
	});

	it("fails required content-ref when empty", () => {
		const requiredType: ContentTypeDefinition = {
			key: "article",
			label: "Article",
			fields: [
				{
					name: "relatedPost",
					label: "Related Post",
					type: "content-ref",
					required: true,
				},
			],
		};
		const error = validateContentFields(requiredType, {});
		expect(error).toContain("is required");
	});
});

// ─── validateContentFields — repeater type ───────────────────────────────────

describe("validateContentFields — repeater type", () => {
	const contentType: ContentTypeDefinition = {
		key: "event",
		label: "Event",
		fields: [
			{
				name: "speakers",
				label: "Speakers",
				type: "repeater",
				fields: [
					{ name: "name", label: "Name", type: "text", required: true },
					{ name: "bio", label: "Bio", type: "textarea" },
				],
			},
		],
	};

	it("passes when value is a valid array of objects", () => {
		expect(
			validateContentFields(contentType, {
				speakers: [{ name: "Alice", bio: "Engineer" }],
			}),
		).toBeNull();
	});

	it("passes when repeater is empty array", () => {
		expect(validateContentFields(contentType, { speakers: [] })).toBeNull();
	});

	it("fails when value is not an array", () => {
		const error = validateContentFields(contentType, {
			speakers: "not-an-array",
		});
		expect(error).toContain("must be an array");
	});

	it("fails when nested required field is missing", () => {
		const error = validateContentFields(contentType, {
			speakers: [{ bio: "Engineer" }],
		});
		expect(error).toContain("is required");
		expect(error).toContain("speakers[0]");
	});

	it("passes when field is not required and absent", () => {
		expect(validateContentFields(contentType, {})).toBeNull();
	});
});

// ─── SQLite metadata persistence ─────────────────────────────────────────────

describe("SQLite upsertContentOverride — metadata persistence", () => {
	function makeStore(db: DatabaseSync) {
		let id = 0;
		const { sqliteContentRepository } = createSqliteContentStore(
			() => db,
			() => `rec_${++id}`,
		);
		return sqliteContentRepository;
	}

	function getStoredMetadata(
		db: DatabaseSync,
		slug: string,
	): Record<string, unknown> | null {
		const row = db
			.prepare("SELECT metadata FROM content_overrides WHERE slug = ? LIMIT 1")
			.get(slug) as { metadata: string | null } | undefined;
		if (!row?.metadata) return null;
		return JSON.parse(row.metadata) as Record<string, unknown>;
	}

	function seedEntry(db: DatabaseSync, slug: string) {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at)
       VALUES (?, ?, ?, 'post', 'content', 'runtime://content/' || ?, CURRENT_TIMESTAMP)`,
		).run(slug, `/${slug}`, `Title for ${slug}`, slug);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_at, updated_by)
       VALUES (?, ?, 'draft', ?, '', CURRENT_TIMESTAMP, 'seed@test.com')`,
		).run(slug, `Title for ${slug}`, `Title for ${slug}`);
	}

	it("persists metadata through upsert and returns it on read", () => {
		const db = makeDb();
		seedEntry(db, "test-post");
		const store = makeStore(db);

		const actor = {
			email: "editor@test.com",
			role: "admin" as const,
			name: "Editor",
		};
		store.saveContentState(
			"test-post",
			{
				title: "Test Post",
				status: "draft",
				seoTitle: "Test Post SEO",
				metaDescription: "A test post",
				metadata: { relatedPost: "other-post", speakers: [{ name: "Alice" }] },
			},
			actor,
		);

		const metadata = getStoredMetadata(db, "test-post");
		expect(metadata).not.toBeNull();
		expect(metadata).toEqual({
			relatedPost: "other-post",
			speakers: [{ name: "Alice" }],
		});
	});

	it("stores null metadata when not provided", () => {
		const db = makeDb();
		seedEntry(db, "no-meta-post");
		const store = makeStore(db);

		const actor = {
			email: "editor@test.com",
			role: "admin" as const,
			name: "Editor",
		};
		store.saveContentState(
			"no-meta-post",
			{
				title: "No Meta Post",
				status: "draft",
				seoTitle: "No Meta",
				metaDescription: "desc",
			},
			actor,
		);

		const metadata = getStoredMetadata(db, "no-meta-post");
		expect(metadata).toBeNull();
	});

	it("updates metadata on subsequent upsert", () => {
		const db = makeDb();
		seedEntry(db, "update-meta-post");
		const store = makeStore(db);

		const actor = {
			email: "editor@test.com",
			role: "admin" as const,
			name: "Editor",
		};
		store.saveContentState(
			"update-meta-post",
			{
				title: "Post",
				status: "draft",
				seoTitle: "Post",
				metaDescription: "desc",
				metadata: { version: 1 },
			},
			actor,
		);
		store.saveContentState(
			"update-meta-post",
			{
				title: "Post",
				status: "draft",
				seoTitle: "Post",
				metaDescription: "desc",
				metadata: { version: 2 },
			},
			actor,
		);

		const metadata = getStoredMetadata(db, "update-meta-post");
		expect((metadata as Record<string, unknown>)?.version).toBe(2);
	});
});

// ─── validateContentFields — validate() callback ─────────────────────────────

describe("validateContentFields — validate() callback", () => {
	it("passes when validate returns true", () => {
		const contentType: ContentTypeDefinition = {
			key: "test",
			label: "Test",
			fields: [
				{ name: "score", label: "Score", type: "number", validate: () => true },
			],
		};
		expect(validateContentFields(contentType, { score: 42 })).toBeNull();
	});

	it("passes when validate returns empty string (falsy → treated as no error)", () => {
		const contentType: ContentTypeDefinition = {
			key: "test",
			label: "Test",
			fields: [
				{ name: "score", label: "Score", type: "number", validate: () => "" },
			],
		};
		expect(validateContentFields(contentType, { score: 42 })).toBeNull();
	});

	it("fails when validate returns a non-empty error string", () => {
		const contentType: ContentTypeDefinition = {
			key: "test",
			label: "Test",
			fields: [
				{
					name: "score",
					label: "Score",
					type: "number",
					validate: () => "Must be positive.",
				},
			],
		};
		expect(validateContentFields(contentType, { score: -1 })).toBe(
			"Must be positive.",
		);
	});

	it("skips validate when value is empty and field is not required", () => {
		const validate = vi.fn(() => "Should not be called");
		const contentType: ContentTypeDefinition = {
			key: "test",
			label: "Test",
			fields: [{ name: "score", label: "Score", type: "number", validate }],
		};
		expect(validateContentFields(contentType, {})).toBeNull();
		expect(validate).not.toHaveBeenCalled();
	});
});

// ─── validateContentFields — repeater null item ───────────────────────────────

describe("validateContentFields — repeater null item check", () => {
	const contentType: ContentTypeDefinition = {
		key: "test",
		label: "Test",
		fields: [
			{
				name: "items",
				label: "Items",
				type: "repeater",
				fields: [{ name: "name", label: "Name", type: "text", required: true }],
			},
		],
	};

	it("fails when a repeater item is null", () => {
		const error = validateContentFields(contentType, { items: [null] });
		expect(error).toContain("item 1 must be an object");
	});

	it("fails when a repeater item is a primitive (string)", () => {
		const error = validateContentFields(contentType, {
			items: ["not-an-object"],
		});
		expect(error).toContain("item 1 must be an object");
	});

	it("uses 1-based index in error message (second item)", () => {
		const error = validateContentFields(contentType, {
			items: [{ name: "ok" }, null],
		});
		expect(error).toContain("item 2 must be an object");
	});

	it("passes repeater with no nested field definitions (fields property absent)", () => {
		const noFieldsType: ContentTypeDefinition = {
			key: "test",
			label: "Test",
			fields: [{ name: "tags", label: "Tags", type: "repeater" }],
		};
		expect(
			validateContentFields(noFieldsType, { tags: [{ anything: true }] }),
		).toBeNull();
	});
});

// ─── validateContentFields — required + isEmpty boundary ─────────────────────

describe("validateContentFields — required field isEmpty cases", () => {
	function requiredField(name: string): ContentTypeDefinition {
		return {
			key: "test",
			label: "Test",
			fields: [{ name, label: "Field", type: "text", required: true }],
		};
	}

	it("treats undefined as empty", () => {
		expect(validateContentFields(requiredField("x"), {})).toContain(
			"is required",
		);
	});

	it("treats null as empty", () => {
		expect(validateContentFields(requiredField("x"), { x: null })).toContain(
			"is required",
		);
	});

	it("treats empty string as empty", () => {
		expect(validateContentFields(requiredField("x"), { x: "" })).toContain(
			"is required",
		);
	});

	it("accepts zero as non-empty (0 is a valid value)", () => {
		expect(validateContentFields(requiredField("x"), { x: 0 })).toBeNull();
	});

	it("accepts false as non-empty (false is a valid boolean value)", () => {
		expect(validateContentFields(requiredField("x"), { x: false })).toBeNull();
	});
});

// ─── content-modeling.ts source structure ────────────────────────────────────

describe("content-modeling.ts — source structure", () => {
	const srcPath = path.resolve(
		import.meta.dirname,
		"../src/content-modeling.ts",
	);

	it("exports FieldDefinition with content-ref type", () => {
		const source = readFileSync(srcPath, "utf8");
		expect(source).toContain('"content-ref"');
	});

	it("exports FieldDefinition with repeater type", () => {
		const source = readFileSync(srcPath, "utf8");
		expect(source).toContain('"repeater"');
	});

	it("exports FieldDefinition with conditionalOn property", () => {
		const source = readFileSync(srcPath, "utf8");
		expect(source).toContain("conditionalOn");
	});

	it("exports FieldDefinition with refKind property", () => {
		const source = readFileSync(srcPath, "utf8");
		expect(source).toContain("refKind");
	});

	it("exports FieldDefinition with fields property for repeater", () => {
		const source = readFileSync(srcPath, "utf8");
		expect(source).toContain("fields?: readonly FieldDefinition[]");
	});
});
