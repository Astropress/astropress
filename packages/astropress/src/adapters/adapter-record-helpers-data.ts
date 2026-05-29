// stryker-disable-file: data-only — SQL-string constants for the D1 adapter
// record helpers. Mutants on these literals are unobservable under the mock-D1
// adapter unit tests and unkillable as static-true under vitest worker-cache.

export const SQL_LIST_TRANSLATIONS =
	"SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC";
export const SQL_D1_INSERT_REVISION = `INSERT INTO content_revisions (id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_at, created_by) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
