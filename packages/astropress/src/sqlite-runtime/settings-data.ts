// stryker-disable-file: data-only — SQL-string constants for the local sqlite
// settings/redirect/comment/translation stores. Mutants on these literals are
// caught by integration tests against the live schema, not Stryker; vitest
// worker-cache makes static-true variants unkillable (project-static-mutants-empirical).

export const SQL_GET_REDIRECT =
	"SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1";
export const SQL_UPSERT_REDIRECT =
	"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status_code = excluded.status_code, created_by = excluded.created_by, deleted_at = NULL";
export const SQL_SOFT_DELETE_REDIRECT =
	"UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL";
export const SQL_UPSERT_SETTINGS =
	"INSERT INTO site_settings (id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(id) DO UPDATE SET site_title = excluded.site_title, site_tagline = excluded.site_tagline, donation_url = excluded.donation_url, newsletter_enabled = excluded.newsletter_enabled, comments_default_policy = excluded.comments_default_policy, admin_slug = excluded.admin_slug, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by";
export const SQL_GET_COMMENT_ROUTE = "SELECT route FROM comments WHERE id = ? LIMIT 1";
export const SQL_UPDATE_COMMENT_STATUS = "UPDATE comments SET status = ? WHERE id = ?";
export const SQL_INSERT_COMMENT =
	"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
export const SQL_READ_TRANSLATION =
	"SELECT state FROM translation_overrides WHERE route = ? LIMIT 1";
export const SQL_UPSERT_TRANSLATION =
	"INSERT INTO translation_overrides (route, state, updated_at, updated_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(route) DO UPDATE SET state = excluded.state, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by";
