// stryker-disable-file: data-only — pure SQL string templates for the bootstrap seeders. Each constant is an INSERT-with-conflict statement; mutating any literal inside the SQL changes column wiring or the conflict clause, but the seeders' observable contract (rows present after bootstrap) is exercised by behavioural tests in tests/sqlite-bootstrap-* through the seeder functions in sqlite-bootstrap-seeders.ts. Keeping the SQL bodies separate lets the consumer file's mutation score reflect logic mutants only.

export const SQL_SEED_SITE_SETTINGS = `
  INSERT INTO site_settings (
    id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;
export const SQL_SEED_SYSTEM_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'system', ?, 'en', ?)
  ON CONFLICT(id) DO UPDATE SET
    render_strategy = excluded.render_strategy,
    canonical_path = excluded.canonical_path,
    updated_at = CURRENT_TIMESTAMP
`;
export const SQL_SEED_SYSTEM_VARIANT = `
  INSERT INTO cms_route_variants (
    id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
    seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
    robots_directive, updated_at, updated_by
  ) VALUES (?, ?, 'en', ?, 'published', ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, ?, CURRENT_TIMESTAMP, ?)
  ON CONFLICT(id) DO UPDATE SET
    path = excluded.path, title = excluded.title, summary = excluded.summary,
    body_html = excluded.body_html, settings_json = excluded.settings_json,
    seo_title = excluded.seo_title, meta_description = excluded.meta_description,
    robots_directive = excluded.robots_directive,
    updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by
`;
export const SQL_SEED_SYSTEM_REVISION = `
  INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
  VALUES (?, ?, ?, 'en', ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;
export const SQL_SEED_ARCHIVE_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'archive', 'archive_listing', 'en', ?)
  ON CONFLICT(id) DO UPDATE SET canonical_path = excluded.canonical_path, updated_at = CURRENT_TIMESTAMP
`;
export const SQL_SEED_ARCHIVE_VARIANT = `
  INSERT INTO cms_route_variants (
    id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
    seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
    robots_directive, updated_at, updated_by
  ) VALUES (?, ?, 'en', ?, 'published', ?, ?, NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, ?, CURRENT_TIMESTAMP, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, summary = excluded.summary, seo_title = excluded.seo_title,
    meta_description = excluded.meta_description, canonical_url_override = excluded.canonical_url_override,
    robots_directive = excluded.robots_directive, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by
`;
export const SQL_SEED_MARKETING_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'page', 'structured_sections', ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    canonical_locale = excluded.canonical_locale, canonical_path = excluded.canonical_path, updated_at = CURRENT_TIMESTAMP
`;
export const SQL_SEED_MARKETING_VARIANT = `
  INSERT INTO cms_route_variants (
    id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
    seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
    robots_directive, updated_at, updated_by
  ) VALUES (?, ?, ?, ?, 'published', ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, summary = excluded.summary, sections_json = excluded.sections_json,
    settings_json = excluded.settings_json, seo_title = excluded.seo_title,
    meta_description = excluded.meta_description, og_image = excluded.og_image,
    canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive,
    updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by
`;
