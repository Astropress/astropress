import { describe, expect, it } from "vitest";
import {
	ensureLegacySchemaCompatibility,
	getTableColumns,
	rebuildContentTablesForCompatibility,
} from "../src/sqlite-schema-compat";
import { makeDb } from "./helpers/make-db.js";

describe("rebuildContentTablesForCompatibility — boolean dispatch picks correct SQL fragment", () => {
	function withMigratedSchema(
		opts: Parameters<typeof rebuildContentTablesForCompatibility>[1] & {
			seedAuthors?: boolean;
			seedCategories?: boolean;
			seedTags?: boolean;
			seedOverrideScheduled?: boolean;
			seedRevisionScheduled?: boolean;
			seedRevisionNote?: boolean;
		},
	) {
		const db = makeDb();
		// Insert one row in content_overrides and one in content_revisions so the
		// migration's INSERT...SELECT actually carries data through.
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, updated_by, body) VALUES ('s1', 'T', 'published', 'u@x', 'B')`,
		).run();
		db.prepare(
			`INSERT INTO content_revisions (id, slug, source, title, status, body, created_by) VALUES ('r1', 's1', 'imported', 'T', 'published', 'B', 'u@x')`,
		).run();
		if (opts.seedAuthors) {
			db.prepare(`UPDATE content_revisions SET author_ids = '["a1"]' WHERE id = 'r1'`).run();
		}
		if (opts.seedCategories) {
			db.prepare(`UPDATE content_revisions SET category_ids = '["c1"]' WHERE id = 'r1'`).run();
		}
		if (opts.seedTags) {
			db.prepare(`UPDATE content_revisions SET tag_ids = '["t1"]' WHERE id = 'r1'`).run();
		}
		if (opts.seedOverrideScheduled) {
			db.prepare(
				`UPDATE content_overrides SET scheduled_at = '2026-01-01' WHERE slug = 's1'`,
			).run();
		}
		if (opts.seedRevisionScheduled) {
			db.prepare(`UPDATE content_revisions SET scheduled_at = '2026-01-02' WHERE id = 'r1'`).run();
		}
		if (opts.seedRevisionNote) {
			db.prepare(`UPDATE content_revisions SET revision_note = 'NOTE' WHERE id = 'r1'`).run();
		}
		rebuildContentTablesForCompatibility(db, opts);
		return db;
	}

	it("hasRevisionAuthorIds=true preserves author_ids via COALESCE(author_ids, '[]')", () => {
		const db = withMigratedSchema({
			hasRevisionAuthorIds: true,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedAuthors: true,
		});
		const row = db.prepare(`SELECT author_ids FROM content_revisions WHERE id = 'r1'`).get() as {
			author_ids: string;
		};
		expect(row.author_ids).toBe('["a1"]');
	});

	it("hasRevisionAuthorIds=false sets author_ids to literal '[]' regardless of source data", () => {
		const db = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedAuthors: true,
		});
		const row = db.prepare(`SELECT author_ids FROM content_revisions WHERE id = 'r1'`).get() as {
			author_ids: string;
		};
		expect(row.author_ids).toBe("[]");
	});

	it("hasRevisionCategoryIds=true preserves category_ids; false yields '[]'", () => {
		const dbTrue = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: true,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedCategories: true,
		});
		expect(
			(
				dbTrue.prepare(`SELECT category_ids FROM content_revisions WHERE id = 'r1'`).get() as {
					category_ids: string;
				}
			).category_ids,
		).toBe('["c1"]');

		const dbFalse = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedCategories: true,
		});
		expect(
			(
				dbFalse.prepare(`SELECT category_ids FROM content_revisions WHERE id = 'r1'`).get() as {
					category_ids: string;
				}
			).category_ids,
		).toBe("[]");
	});

	it("hasRevisionTagIds=true preserves tag_ids; false yields '[]'", () => {
		const dbTrue = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: true,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedTags: true,
		});
		expect(
			(
				dbTrue.prepare(`SELECT tag_ids FROM content_revisions WHERE id = 'r1'`).get() as {
					tag_ids: string;
				}
			).tag_ids,
		).toBe('["t1"]');

		const dbFalse = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedTags: true,
		});
		expect(
			(
				dbFalse.prepare(`SELECT tag_ids FROM content_revisions WHERE id = 'r1'`).get() as {
					tag_ids: string;
				}
			).tag_ids,
		).toBe("[]");
	});

	it("hasOverrideScheduledAt=true preserves overrides.scheduled_at; false yields NULL", () => {
		const dbTrue = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: true,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedOverrideScheduled: true,
		});
		expect(
			(
				dbTrue.prepare(`SELECT scheduled_at FROM content_overrides WHERE slug = 's1'`).get() as {
					scheduled_at: string | null;
				}
			).scheduled_at,
		).toBe("2026-01-01");

		const dbFalse = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedOverrideScheduled: true,
		});
		expect(
			(
				dbFalse.prepare(`SELECT scheduled_at FROM content_overrides WHERE slug = 's1'`).get() as {
					scheduled_at: string | null;
				}
			).scheduled_at,
		).toBeNull();
	});

	it("hasRevisionScheduledAt=true preserves revisions.scheduled_at; false yields NULL", () => {
		const dbTrue = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: true,
			hasRevisionNote: false,
			seedRevisionScheduled: true,
		});
		expect(
			(
				dbTrue.prepare(`SELECT scheduled_at FROM content_revisions WHERE id = 'r1'`).get() as {
					scheduled_at: string | null;
				}
			).scheduled_at,
		).toBe("2026-01-02");

		const dbFalse = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedRevisionScheduled: true,
		});
		expect(
			(
				dbFalse.prepare(`SELECT scheduled_at FROM content_revisions WHERE id = 'r1'`).get() as {
					scheduled_at: string | null;
				}
			).scheduled_at,
		).toBeNull();
	});

	it("hasRevisionNote=true preserves revision_note; false yields NULL", () => {
		const dbTrue = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: true,
			seedRevisionNote: true,
		});
		expect(
			(
				dbTrue.prepare(`SELECT revision_note FROM content_revisions WHERE id = 'r1'`).get() as {
					revision_note: string | null;
				}
			).revision_note,
		).toBe("NOTE");

		const dbFalse = withMigratedSchema({
			hasRevisionAuthorIds: false,
			hasRevisionCategoryIds: false,
			hasRevisionTagIds: false,
			hasOverrideScheduledAt: false,
			hasRevisionScheduledAt: false,
			hasRevisionNote: false,
			seedRevisionNote: true,
		});
		expect(
			(
				dbFalse.prepare(`SELECT revision_note FROM content_revisions WHERE id = 'r1'`).get() as {
					revision_note: string | null;
				}
			).revision_note,
		).toBeNull();
	});
});

describe("ensureLegacySchemaCompatibility — dispatch conditions", () => {
	it("is a no-op on a freshly seeded modern schema (no rebuild fires)", () => {
		const db = makeDb();
		const beforeCols = getTableColumns(db, "content_revisions").sort();
		ensureLegacySchemaCompatibility(db);
		const afterCols = getTableColumns(db, "content_revisions").sort();
		expect(afterCols).toEqual(beforeCols);
	});

	it("adds metadata column to content_overrides when missing", () => {
		const db = makeDb();
		db.exec("DROP TABLE content_overrides");
		db.exec(
			"CREATE TABLE content_overrides (slug TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')), body TEXT, seo_title TEXT, meta_description TEXT, excerpt TEXT, og_title TEXT, og_description TEXT, og_image TEXT, canonical_url_override TEXT, robots_directive TEXT, scheduled_at TEXT, updated_at TEXT, updated_by TEXT NOT NULL)",
		);
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_overrides")).toContain("metadata");
	});

	it("adds thumbnail_url and srcset columns to media_assets when missing", () => {
		const db = makeDb();
		db.exec("ALTER TABLE media_assets DROP COLUMN thumbnail_url");
		db.exec("ALTER TABLE media_assets DROP COLUMN srcset");
		ensureLegacySchemaCompatibility(db);
		const cols = getTableColumns(db, "media_assets");
		expect(cols).toContain("thumbnail_url");
		expect(cols).toContain("srcset");
	});

	it("adds rollback_sql column to schema_migrations when missing", () => {
		const db = makeDb();
		db.exec("ALTER TABLE schema_migrations DROP COLUMN rollback_sql");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "schema_migrations")).toContain("rollback_sql");
	});

	it("creates content_locks table when absent", () => {
		const db = makeDb();
		db.exec("DROP TABLE content_locks");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_locks")).toContain("slug");
		expect(getTableColumns(db, "content_locks")).toContain("lock_token");
	});

	it("backfills is_admin from legacy role='admin' when adding the column", () => {
		const db = makeDb();
		// Recreate legacy admin_users with role column
		db.exec("DROP TABLE admin_users");
		db.exec(
			"CREATE TABLE admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
		);
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name) VALUES (?, 'h', 'admin', 'A')",
		).run("a@x");
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name) VALUES (?, 'h', 'editor', 'E')",
		).run("e@x");
		ensureLegacySchemaCompatibility(db);
		const a = db.prepare("SELECT is_admin FROM admin_users WHERE email = ?").get("a@x") as {
			is_admin: number;
		};
		const e = db.prepare("SELECT is_admin FROM admin_users WHERE email = ?").get("e@x") as {
			is_admin: number;
		};
		expect(a.is_admin).toBe(1);
		expect(e.is_admin).toBe(0);
		// Role column should be dropped after the terminal migration
		expect(getTableColumns(db, "admin_users")).not.toContain("role");
	});

	it("admin_users migration uses email when name column is missing (kills nameExpr fallback mutant)", () => {
		const db = makeDb();
		db.exec("DROP TABLE admin_users");
		db.exec(
			"CREATE TABLE admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL)",
		);
		db.prepare("INSERT INTO admin_users (email, password_hash, role) VALUES (?, 'h', 'admin')").run(
			"only-email@x",
		);
		ensureLegacySchemaCompatibility(db);
		const row = db.prepare("SELECT name FROM admin_users WHERE email = ?").get("only-email@x") as {
			name: string;
		};
		expect(row.name).toBe("only-email@x");
	});

	it("admin_users migration defaults active=1 when active column is missing", () => {
		const db = makeDb();
		db.exec("DROP TABLE admin_users");
		db.exec(
			"CREATE TABLE admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL)",
		);
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name) VALUES (?, 'h', 'editor', 'N')",
		).run("u@x");
		ensureLegacySchemaCompatibility(db);
		const row = db.prepare("SELECT active FROM admin_users WHERE email = ?").get("u@x") as {
			active: number;
		};
		expect(row.active).toBe(1);
	});

	it("triggers full rebuild when content_revisions lacks author_ids column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_revisions DROP COLUMN author_ids");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_revisions")).toContain("author_ids");
	});

	it("triggers full rebuild when content_revisions lacks category_ids column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_revisions DROP COLUMN category_ids");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_revisions")).toContain("category_ids");
	});

	it("triggers full rebuild when content_revisions lacks tag_ids column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_revisions DROP COLUMN tag_ids");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_revisions")).toContain("tag_ids");
	});

	it("triggers full rebuild when content_revisions lacks scheduled_at column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_revisions DROP COLUMN scheduled_at");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_revisions")).toContain("scheduled_at");
	});

	it("triggers full rebuild when content_revisions lacks revision_note column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_revisions DROP COLUMN revision_note");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_revisions")).toContain("revision_note");
	});

	it("triggers full rebuild when content_overrides lacks scheduled_at column", () => {
		const db = makeDb();
		db.exec("ALTER TABLE content_overrides DROP COLUMN scheduled_at");
		ensureLegacySchemaCompatibility(db);
		expect(getTableColumns(db, "content_overrides")).toContain("scheduled_at");
	});

	it("admin_users uses literal 'active' when column exists (kills activeExpr fallback)", () => {
		const db = makeDb();
		db.exec("DROP TABLE admin_users");
		db.exec(
			"CREATE TABLE admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
		);
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, 'h', 'admin', 'A', 0)",
		).run("inactive@x");
		ensureLegacySchemaCompatibility(db);
		const row = db.prepare("SELECT active FROM admin_users WHERE email = ?").get("inactive@x") as {
			active: number;
		};
		// active column preserved → 0 from source row (not the fallback 1)
		expect(row.active).toBe(0);
	});

	it("admin_users created_at fallback uses CURRENT_TIMESTAMP when column missing", () => {
		const db = makeDb();
		db.exec("DROP TABLE admin_users");
		db.exec(
			"CREATE TABLE admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL)",
		);
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name) VALUES (?, 'h', 'admin', 'A')",
		).run("u@x");
		ensureLegacySchemaCompatibility(db);
		const row = db.prepare("SELECT created_at FROM admin_users WHERE email = ?").get("u@x") as {
			created_at: string;
		};
		expect(typeof row.created_at).toBe("string");
		expect(row.created_at.length).toBeGreaterThan(0);
	});

	it("contentLocks DDL emits the slug and lock_token columns when triggered", () => {
		const db = makeDb();
		db.exec("DROP TABLE content_locks");
		ensureLegacySchemaCompatibility(db);
		const cols = getTableColumns(db, "content_locks");
		expect(cols).toContain("slug");
		expect(cols).toContain("locked_by_email");
		expect(cols).toContain("locked_by_name");
		expect(cols).toContain("lock_token");
		expect(cols).toContain("expires_at");
		expect(cols).toContain("acquired_at");
	});

	it("triggers full rebuild when content_overrides lacks 'review' status (expanded statuses)", () => {
		const db = makeDb();
		db.exec("DROP TABLE content_revisions");
		db.exec("DROP TABLE content_overrides");
		// Legacy: only 'draft' and 'published'
		db.exec(
			"CREATE TABLE content_overrides (slug TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft', 'published')), body TEXT, seo_title TEXT, meta_description TEXT, excerpt TEXT, og_title TEXT, og_description TEXT, og_image TEXT, canonical_url_override TEXT, robots_directive TEXT, scheduled_at TEXT, updated_at TEXT, updated_by TEXT NOT NULL)",
		);
		db.exec(
			"CREATE TABLE content_revisions (id TEXT PRIMARY KEY, slug TEXT NOT NULL, source TEXT, title TEXT, status TEXT NOT NULL CHECK(status IN ('draft', 'published')), body TEXT, seo_title TEXT, meta_description TEXT, excerpt TEXT, og_title TEXT, og_description TEXT, og_image TEXT, author_ids TEXT, category_ids TEXT, tag_ids TEXT, canonical_url_override TEXT, robots_directive TEXT, revision_note TEXT, scheduled_at TEXT, created_at TEXT, created_by TEXT)",
		);
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, updated_by) VALUES ('s', 'T', 'published', 'u@x')",
		).run();
		ensureLegacySchemaCompatibility(db);
		// After rebuild, schema CHECK should accept 'archived'
		expect(() => {
			db.prepare("UPDATE content_overrides SET status = 'archived' WHERE slug = 's'").run();
		}).not.toThrow();
	});
});
