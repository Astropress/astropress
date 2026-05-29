// stryker-disable-file: data-only — SQL-string constants for the sqlite adapter
// helpers; mutants unobservable under mock-driver unit tests, unkillable as
// static-true under vitest worker-cache (project-static-mutants-empirical).

export const SQL_UPSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, deleted_at = NULL";
export const SQL_INSERT_REVISION = `INSERT INTO content_revisions (id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_at, created_by) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const SQL_LIST_TRANSLATIONS =
	"SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC";
