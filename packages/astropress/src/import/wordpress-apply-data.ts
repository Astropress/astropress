// stryker-disable-file: data-only — pure SQL strings and actor constants; runtime
// behavior is in wordpress-apply.ts. Mutating these strings to "" trivially breaks
// the runtime but is unobservable as a behavioral change distinct from the runtime
// callers themselves.

export const SQL_UPSERT_CATEGORY =
	"INSERT INTO categories (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP";
export const SQL_UPSERT_TAG =
	"INSERT INTO tags (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP";
export const SQL_SELECT_CATEGORY_ID = "SELECT id FROM categories WHERE slug = ? LIMIT 1";
export const SQL_SELECT_TAG_ID = "SELECT id FROM tags WHERE slug = ? LIMIT 1";
export const SQL_UPDATE_ENTRY_LEGACY =
	"UPDATE content_entries SET legacy_url = ?, summary = ?, kind = ? WHERE slug = ?";
export const SQL_UPDATE_ENTRY_LEGACY_FULL =
	"UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?";
export const SQL_UPSERT_AUTHOR =
	"INSERT INTO authors (slug, name, bio, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, bio = excluded.bio, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP";
export const SQL_SELECT_AUTHOR_ID = "SELECT id FROM authors WHERE slug = ? LIMIT 1";
export const SQL_UPSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, uploaded_by = excluded.uploaded_by, deleted_at = NULL";
export const SQL_UPSERT_COMMENT =
	"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET author = excluded.author, email = excluded.email, body = excluded.body, route = excluded.route, status = excluded.status, policy = excluded.policy, submitted_at = excluded.submitted_at";
export const SQL_UPSERT_REDIRECT =
	"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status_code = excluded.status_code, created_by = excluded.created_by, deleted_at = NULL";

export const WORDPRESS_IMPORT_ACTOR = {
	email: "wordpress-import@astropress.local",
	role: "admin" as const,
	name: "WordPress Import",
};
