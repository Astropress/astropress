import { getCmsConfig } from "./config.js";
import type {
	ArchiveSeedRecord,
	AstropressSqliteSeedToolkitOptions,
	MarketingRouteSeedRecord,
	SqliteDatabaseLike,
	SystemRouteSeed,
} from "./sqlite-bootstrap.js";
import { guessMimeType, hashPasswordSync } from "./sqlite-seed-helpers.js";

const SQL_SEED_SITE_SETTINGS = `
  INSERT INTO site_settings (
    id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;
const SQL_SEED_SYSTEM_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'system', ?, 'en', ?)
  ON CONFLICT(id) DO UPDATE SET
    render_strategy = excluded.render_strategy,
    canonical_path = excluded.canonical_path,
    updated_at = CURRENT_TIMESTAMP
`;
const SQL_SEED_SYSTEM_VARIANT = `
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
const SQL_SEED_SYSTEM_REVISION = `
  INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
  VALUES (?, ?, ?, 'en', ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;
const SQL_SEED_ARCHIVE_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'archive', 'archive_listing', 'en', ?)
  ON CONFLICT(id) DO UPDATE SET canonical_path = excluded.canonical_path, updated_at = CURRENT_TIMESTAMP
`;
const SQL_SEED_ARCHIVE_VARIANT = `
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
const SQL_SEED_MARKETING_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'page', 'structured_sections', ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    canonical_locale = excluded.canonical_locale, canonical_path = excluded.canonical_path, updated_at = CURRENT_TIMESTAMP
`;
const SQL_SEED_MARKETING_VARIANT = `
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

/** Build bind params for a system route variant insert. */
function systemRouteVariantParams(route: SystemRouteSeed) {
	return [
		route.variantId,
		route.groupId,
		route.path,
		route.title,
		route.summary ?? null,
		route.bodyHtml ?? null,
		route.settingsJson ?? null,
		route.title,
		route.metaDescription ?? route.summary ?? route.title,
		route.robotsDirective ?? null,
		"seed-import",
	];
}

/** Build the revision snapshot JSON for a system route. */
function systemRouteSnapshot(route: SystemRouteSeed) {
	return JSON.stringify({
		path: route.path,
		title: route.title,
		summary: route.summary ?? "",
		bodyHtml: route.bodyHtml ?? "",
		settings: route.settingsJson ? JSON.parse(route.settingsJson) : null,
		renderStrategy: route.renderStrategy,
	});
}

/** Build bind params for an archive route variant insert. */
function archiveVariantParams(
	archive: ArchiveSeedRecord,
	variantId: string,
	groupId: string,
) {
	return [
		variantId,
		groupId,
		archive.legacyUrl,
		archive.title,
		archive.summary ?? null,
		archive.seoTitle ?? archive.title,
		archive.metaDescription ?? archive.summary ?? "",
		archive.canonicalUrlOverride ?? null,
		archive.robotsDirective ?? null,
		"seed-import",
	];
}

/** Resolve a marketing route's locale from config or fallback. */
function resolveMarketingLocale(pagePath: string): string {
	let configLocales: readonly string[];
	try {
		configLocales = getCmsConfig().locales ?? ["en", "es"];
	} catch {
		configLocales = ["en", "es"];
	}
	return (
		configLocales.find((l) => pagePath.startsWith(`/${l}/`)) ??
		configLocales[0] ??
		"en"
	);
}

/** Build bind params for a marketing route variant insert. */
function marketingVariantParams(
	page: MarketingRouteSeedRecord,
	variantId: string,
	groupId: string,
	locale: string,
) {
	return [
		variantId,
		groupId,
		locale,
		page.path,
		page.title,
		page.summary,
		JSON.stringify(page.sections),
		JSON.stringify({
			templateKey: page.templateKey,
			alternateLinks: page.alternateLinks ?? [],
		}),
		page.seoTitle,
		page.metaDescription,
		page.ogImage ?? null,
		page.canonicalUrlOverride ?? null,
		page.robotsDirective ?? null,
		"seed-import",
	];
}

export function seedBootstrapUsers(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const upsert = db.prepare(`
    INSERT INTO admin_users (email, password_hash, role, name, active)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = excluded.role,
      name = excluded.name,
      active = 1
  `);
	let count = 0;
	for (const user of options.loadBootstrapUsers()) {
		const result = upsert.run(
			user.email.toLowerCase(),
			hashPasswordSync(user.password),
			user.role,
			user.name,
		) as { changes?: number };
		count += result.changes ?? 1;
	}
	return count;
}

export function seedMediaAssets(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
	workspaceRoot: string,
) {
	const insert = db.prepare(`
    INSERT INTO media_assets (
      id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_url = excluded.source_url,
      local_path = excluded.local_path,
      r2_key = excluded.r2_key,
      mime_type = excluded.mime_type,
      uploaded_by = excluded.uploaded_by,
      deleted_at = NULL
  `);
	let count = 0;
	for (const asset of options.loadMediaSeeds(workspaceRoot)) {
		const result = insert.run(
			asset.id,
			asset.sourceUrl ?? null,
			asset.localPath ?? `/images/legacy/${asset.id}`,
			asset.r2Key ?? null,
			guessMimeType(asset.localPath ?? asset.sourceUrl ?? asset.id),
			null,
			"",
			asset.id,
			"seed-import",
		) as { changes?: number };
		count += result.changes ?? 1;
	}
	return count;
}

export function seedRedirects(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const insert = db.prepare(`
    INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
    VALUES (?, ?, ?, ?, NULL)
    ON CONFLICT(source_path) DO UPDATE SET
      target_path = excluded.target_path,
      status_code = excluded.status_code,
      created_by = excluded.created_by,
      deleted_at = NULL
  `);
	let count = 0;
	for (const rule of options.redirectRules) {
		const result = insert.run(
			rule.sourcePath,
			rule.targetPath,
			rule.statusCode,
			"seed-import",
		) as { changes?: number };
		count += result.changes ?? 1;
	}
	return count;
}

export function seedComments(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const insert = db.prepare(`
    INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    ON CONFLICT(id) DO NOTHING
  `);
	let count = 0;
	for (const comment of options.comments) {
		const result = insert.run(
			comment.id,
			comment.author,
			comment.email ?? null,
			comment.body ?? null,
			comment.route,
			comment.status,
			comment.policy,
			comment.submittedAt ?? null,
		) as { changes?: number };
		count += result.changes ?? 0;
	}
	return count;
}

export function seedSiteSettings(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const result = db
		.prepare(SQL_SEED_SITE_SETTINGS)
		.run(
			1,
			options.siteSettings.siteTitle,
			options.siteSettings.siteTagline,
			options.siteSettings.donationUrl,
			options.siteSettings.newsletterEnabled ? 1 : 0,
			options.siteSettings.commentsDefaultPolicy,
			"seed-import",
		) as { changes?: number };
	return result.changes ?? 0;
}

export function seedSystemRoutes(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const insertGroup = db.prepare(SQL_SEED_SYSTEM_GROUP);
	const insertVariant = db.prepare(SQL_SEED_SYSTEM_VARIANT);
	const insertRevision = db.prepare(SQL_SEED_SYSTEM_REVISION);

	let count = 0;
	for (const route of options.systemRoutes) {
		insertGroup.run(route.groupId, route.renderStrategy, route.path);
		const result = insertVariant.run(...systemRouteVariantParams(route)) as {
			changes?: number;
		};
		count += result.changes ?? 1;
		insertRevision.run(
			`revision:${route.variantId}:seed`,
			route.variantId,
			route.path,
			systemRouteSnapshot(route),
			"Imported baseline",
			"seed-import",
		);
	}
	return count;
}

export function seedArchiveRoutes(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const insertGroup = db.prepare(SQL_SEED_ARCHIVE_GROUP);
	const insertVariant = db.prepare(SQL_SEED_ARCHIVE_VARIANT);

	let count = 0;
	for (const archive of options.archiveRoutes) {
		const baseId =
			archive.legacyUrl.replace(/^\//, "").replaceAll("/", ":") || "root";
		const groupId = `archive:${baseId}`;
		const variantId = `variant:archive:${baseId}:en`;
		insertGroup.run(groupId, archive.legacyUrl);
		const result = insertVariant.run(
			...archiveVariantParams(archive, variantId, groupId),
		) as { changes?: number };
		count += result.changes ?? 1;
	}
	return count;
}

export function seedMarketingRoutes(
	options: AstropressSqliteSeedToolkitOptions,
	db: SqliteDatabaseLike,
) {
	const insertGroup = db.prepare(SQL_SEED_MARKETING_GROUP);
	const insertVariant = db.prepare(SQL_SEED_MARKETING_VARIANT);

	let count = 0;
	for (const page of options.marketingRoutes) {
		const locale = resolveMarketingLocale(page.path);
		const baseId = page.path.replace(/^\//, "").replaceAll("/", ":");
		const groupId = `page:${baseId}`;
		const variantId = `variant:page:${baseId}:${locale}`;
		insertGroup.run(groupId, locale, page.path);
		const result = insertVariant.run(
			...marketingVariantParams(page, variantId, groupId, locale),
		) as { changes?: number };
		count += result.changes ?? 1;
	}
	return count;
}
