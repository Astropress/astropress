import type { SqliteDatabaseLike } from "./sqlite-bootstrap.js";
import {
	ADMIN_USERS_DROP_ROLE_HEAD,
	ADMIN_USERS_DROP_ROLE_TAIL,
	CONTENT_LOCKS_DDL,
	FTS5_INDEX_DDL,
	REBUILD_OVERRIDES_HEAD,
	REBUILD_OVERRIDES_TAIL,
	REBUILD_REVISIONS_FOOTER,
	REBUILD_REVISIONS_MID_AFTER_TAGS,
	REBUILD_REVISIONS_MID_BEFORE_AUTHORS,
} from "./sqlite-schema-compat-data.js";

export function getTableColumns(db: SqliteDatabaseLike, table: string) {
	return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
		(column) => column.name,
	);
}

export function getTableSql(db: SqliteDatabaseLike, table: string) {
	return (
		db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
			| { sql: string | null }
			| undefined
	)?.sql;
}

export function rebuildContentTablesForCompatibility(
	db: SqliteDatabaseLike,
	options: {
		hasRevisionAuthorIds: boolean;
		hasRevisionCategoryIds: boolean;
		hasRevisionTagIds: boolean;
		hasOverrideScheduledAt: boolean;
		hasRevisionScheduledAt: boolean;
		hasRevisionNote: boolean;
	},
) {
	const authorIdsSelect = options.hasRevisionAuthorIds ? "COALESCE(author_ids, '[]')" : "'[]'";
	const categoryIdsSelect = options.hasRevisionCategoryIds
		? "COALESCE(category_ids, '[]')"
		: "'[]'";
	const tagIdsSelect = options.hasRevisionTagIds ? "COALESCE(tag_ids, '[]')" : "'[]'";
	const overrideScheduledAtSelect = options.hasOverrideScheduledAt ? "scheduled_at" : "NULL";
	const revisionScheduledAtSelect = options.hasRevisionScheduledAt ? "scheduled_at" : "NULL";
	const revisionNoteSelect = options.hasRevisionNote ? "revision_note" : "NULL";

	db.exec(
		REBUILD_OVERRIDES_HEAD +
			overrideScheduledAtSelect +
			REBUILD_OVERRIDES_TAIL +
			revisionScheduledAtSelect +
			REBUILD_REVISIONS_MID_BEFORE_AUTHORS +
			authorIdsSelect +
			",\n      " +
			categoryIdsSelect +
			",\n      " +
			tagIdsSelect +
			REBUILD_REVISIONS_MID_AFTER_TAGS +
			revisionNoteSelect +
			REBUILD_REVISIONS_FOOTER,
	);
}

export function ensureFts5SearchIndex(db: SqliteDatabaseLike) {
	const existing = db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_fts'")
		.get() as { name: string } | undefined;
	if (existing) {
		return;
	}
	db.exec(FTS5_INDEX_DDL);
}

export function ensureLegacySchemaCompatibility(db: SqliteDatabaseLike) {
	const revisionColumns = new Set(getTableColumns(db, "content_revisions"));
	const overrideColumns = new Set(getTableColumns(db, "content_overrides"));
	const needsRevisionColumns =
		!revisionColumns.has("author_ids") ||
		!revisionColumns.has("category_ids") ||
		!revisionColumns.has("tag_ids") ||
		!revisionColumns.has("scheduled_at") ||
		!revisionColumns.has("revision_note");
	const needsOverrideColumns = !overrideColumns.has("scheduled_at");

	if (!overrideColumns.has("metadata")) {
		db.exec("ALTER TABLE content_overrides ADD COLUMN metadata TEXT");
	}

	const mediaColumns = new Set(getTableColumns(db, "media_assets"));
	if (!mediaColumns.has("thumbnail_url")) {
		db.exec("ALTER TABLE media_assets ADD COLUMN thumbnail_url TEXT");
	}
	if (!mediaColumns.has("srcset")) {
		db.exec("ALTER TABLE media_assets ADD COLUMN srcset TEXT");
	}

	const migrationColumns = new Set(getTableColumns(db, "schema_migrations"));
	if (!migrationColumns.has("rollback_sql")) {
		db.exec("ALTER TABLE schema_migrations ADD COLUMN rollback_sql TEXT");
	}

	// ABAC migration: existing DBs may have admin_users with the old
	// 'role TEXT NOT NULL CHECK(...)' column and no is_admin column. Add
	// is_admin if missing and backfill from the legacy role enum, then
	// drop the role column entirely (terminal access-PR migration).
	const adminUserColumns = new Set(getTableColumns(db, "admin_users"));
	if (adminUserColumns.size > 0 && !adminUserColumns.has("is_admin")) {
		db.exec("ALTER TABLE admin_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
		if (adminUserColumns.has("role")) {
			db.exec("UPDATE admin_users SET is_admin = 1 WHERE role = 'admin'");
		}
	}

	// Terminal access-PR migration: rebuild admin_users without the legacy
	// `role` column. Fires when the column is still present after the
	// is_admin backfill above. Idempotent: only runs when role exists.
	const refreshedAdminColumns = new Set(getTableColumns(db, "admin_users"));
	if (refreshedAdminColumns.has("role")) {
		const activeExpr = refreshedAdminColumns.has("active") ? "active" : "1";
		const createdAtExpr = refreshedAdminColumns.has("created_at")
			? "created_at"
			: "CURRENT_TIMESTAMP";
		const nameExpr = refreshedAdminColumns.has("name") ? "name" : "email";
		db.exec(
			ADMIN_USERS_DROP_ROLE_HEAD +
				nameExpr +
				", " +
				activeExpr +
				", " +
				createdAtExpr +
				ADMIN_USERS_DROP_ROLE_TAIL,
		);
	}

	const contentLocksExists = getTableSql(db, "content_locks");
	if (!contentLocksExists) {
		db.exec(CONTENT_LOCKS_DDL);
	}

	const overrideSql = getTableSql(db, "content_overrides") ?? "";
	const revisionSql = getTableSql(db, "content_revisions") ?? "";
	const needsExpandedStatuses =
		!overrideSql.includes("'review'") ||
		!overrideSql.includes("'archived'") ||
		!revisionSql.includes("'review'") ||
		!revisionSql.includes("'archived'");

	if (!needsRevisionColumns && !needsOverrideColumns && !needsExpandedStatuses) {
		return;
	}

	rebuildContentTablesForCompatibility(db, {
		hasRevisionAuthorIds: revisionColumns.has("author_ids"),
		hasRevisionCategoryIds: revisionColumns.has("category_ids"),
		hasRevisionTagIds: revisionColumns.has("tag_ids"),
		hasOverrideScheduledAt: overrideColumns.has("scheduled_at"),
		hasRevisionScheduledAt: revisionColumns.has("scheduled_at"),
		hasRevisionNote: revisionColumns.has("revision_note"),
	});
}
