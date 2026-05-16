/**
 * sqlite-runtime/assets mutation pins.
 *
 * Exercises the SQLite-backed media repository wired by createSqliteAssetsStore:
 * listMediaAssets row-mapping fallbacks, updateMediaAsset trimming + audit,
 * and deleteMediaAsset audit recording.
 */

import { describe, expect, it } from "vitest";

import { createSqliteAssetsStore } from "../../src/sqlite-runtime/assets.js";
import { makeDb, STANDARD_ACTOR } from "../helpers/make-db.js";

function insertMediaRow(
	db: ReturnType<typeof makeDb>,
	row: {
		id: string;
		localPath?: string;
		altText?: string | null;
		title?: string | null;
		uploadedBy?: string | null;
		sourceUrl?: string | null;
	},
) {
	db.prepare(
		"INSERT INTO media_assets (id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		row.id,
		row.sourceUrl ?? null,
		row.localPath ?? `/var/data/${row.id}`,
		`uploads/${row.id}`,
		"image/png",
		1024,
		row.altText === undefined ? "alt" : row.altText,
		row.title === undefined ? "title" : row.title,
		row.uploadedBy === undefined ? "uploader@test.local" : row.uploadedBy,
	);
}

function makeStore(db: ReturnType<typeof makeDb>) {
	return createSqliteAssetsStore(
		() => db,
		() => Date.now(),
	);
}

describe("createSqliteAssetsStore — listMediaAssets row mapping", () => {
	it("coalesces NULL alt_text / title / uploaded_by to empty strings (kills L79/L80/L82 StringLiteral & L82 LogicalOperator)", () => {
		const db = makeDb();
		insertMediaRow(db, { id: "m_null", altText: null, title: null, uploadedBy: null });
		const { sqliteMediaRepository } = makeStore(db);

		const listed = sqliteMediaRepository.listMediaAssets().find((m) => m.id === "m_null");
		expect(listed?.altText).toBe("");
		expect(listed?.title).toBe("");
		expect(listed?.uploadedBy).toBe("");
	});

	it("passes through non-NULL alt_text / title / uploaded_by verbatim (kills L82 LogicalOperator ?? → &&)", () => {
		const db = makeDb();
		insertMediaRow(db, {
			id: "m_set",
			altText: "a description",
			title: "A Title",
			uploadedBy: "bob@test.local",
		});
		const { sqliteMediaRepository } = makeStore(db);

		const listed = sqliteMediaRepository.listMediaAssets().find((m) => m.id === "m_set");
		expect(listed?.altText).toBe("a description");
		expect(listed?.title).toBe("A Title");
		// `row.uploaded_by ?? ""` with `&&` would yield "" for a non-null value.
		expect(listed?.uploadedBy).toBe("bob@test.local");
	});
});

describe("createSqliteAssetsStore — updateMediaAsset", () => {
	it("trims title and altText before persisting (kills L101 MethodExpression & OptionalChaining)", () => {
		const db = makeDb();
		insertMediaRow(db, { id: "m_upd" });
		const { sqliteMediaRepository } = makeStore(db);

		const result = sqliteMediaRepository.updateMediaAsset(
			{ id: "m_upd", title: "  Spaced Title  ", altText: "  spaced alt  " },
			STANDARD_ACTOR,
		);
		expect(result.ok).toBe(true);

		const row = db
			.prepare("SELECT title, alt_text FROM media_assets WHERE id = ?")
			.get("m_upd") as { title: string; alt_text: string };
		expect(row.title).toBe("Spaced Title");
		expect(row.alt_text).toBe("spaced alt");
	});

	it("defaults missing title/altText to empty strings without throwing (kills L101 StringLiteral '' fallbacks & OptionalChaining)", () => {
		const db = makeDb();
		insertMediaRow(db, { id: "m_blank", title: "old", altText: "old alt" });
		const { sqliteMediaRepository } = makeStore(db);

		// input.title / input.altText are undefined → `?.trim()` short-circuits to
		// undefined → `?? ""`. Removing the optional chain would throw on undefined;
		// mutating the "" fallback would persist a non-empty placeholder.
		const result = sqliteMediaRepository.updateMediaAsset({ id: "m_blank" }, STANDARD_ACTOR);
		expect(result.ok).toBe(true);

		const row = db
			.prepare("SELECT title, alt_text FROM media_assets WHERE id = ?")
			.get("m_blank") as { title: string; alt_text: string };
		expect(row.title).toBe("");
		expect(row.alt_text).toBe("");
	});

	it("records a media.update audit event scoped to content (kills L110 StringLiteral & template literal)", () => {
		const db = makeDb();
		insertMediaRow(db, { id: "m_audit" });
		const { sqliteMediaRepository } = makeStore(db);

		sqliteMediaRepository.updateMediaAsset({ id: "m_audit", title: "New" }, STANDARD_ACTOR);

		const audit = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE resource_id = ?",
			)
			.get("m_audit") as
			| { action: string; resource_type: string; resource_id: string; summary: string }
			| undefined;
		expect(audit?.action).toBe("media.update");
		expect(audit?.resource_type).toBe("content");
		expect(audit?.summary).toContain("m_audit");
	});
});

describe("createSqliteAssetsStore — deleteMediaAsset", () => {
	it("soft-deletes the row and records a media.delete audit event (kills L166 BlockStatement & L167 StringLiteral)", () => {
		const db = makeDb();
		// local_path outside /images/uploads/ so deleteLocalMediaUpload is a no-op.
		insertMediaRow(db, { id: "m_del", localPath: "/var/data/m_del" });
		const { sqliteMediaRepository } = makeStore(db);

		const result = sqliteMediaRepository.deleteMediaAsset("m_del", STANDARD_ACTOR);
		expect(result.ok).toBe(true);

		const row = db.prepare("SELECT deleted_at FROM media_assets WHERE id = ?").get("m_del") as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();

		const audit = db
			.prepare("SELECT action, resource_type FROM audit_events WHERE resource_id = ?")
			.get("m_del") as { action: string; resource_type: string } | undefined;
		expect(audit?.action).toBe("media.delete");
		expect(audit?.resource_type).toBe("content");
	});
});
