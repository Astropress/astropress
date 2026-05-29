// stryker-disable-file: data-only — SQL-string constants for the Cloudflare/D1
// adapter. Mutants on these literals are caught by integration tests against the
// live D1 schema, not by Stryker (adapter unit tests use a mock D1 driver, so a
// mutated query string is unobservable); vitest worker-cache also makes the
// static-true variants unkillable per project-static-mutants-empirical.

export const SQL_UPSERT_REDIRECT =
	"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status_code = excluded.status_code, created_by = excluded.created_by, deleted_at = NULL";
export const SQL_UPSERT_SETTINGS =
	"INSERT INTO site_settings (id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET site_title = excluded.site_title, site_tagline = excluded.site_tagline, donation_url = excluded.donation_url, newsletter_enabled = excluded.newsletter_enabled, comments_default_policy = excluded.comments_default_policy, admin_slug = excluded.admin_slug, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_UPSERT_TRANSLATION =
	"INSERT INTO translation_overrides (route, state, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(route) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_INSERT_CONTENT =
	"INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
export const SQL_UPSERT_OVERRIDE =
	"INSERT INTO content_overrides (slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_UPSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, deleted_at = NULL";
