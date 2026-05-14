// stryker-disable-file: data-only — module-level table-name allowlist that
// caches through the vitest worker pool (static mutants survive regardless of
// test coverage). Behavioural callers in sqlite-bootstrap-helpers.ts /
// sqlite-bootstrap.ts are mutation-tested at ≥95% and exercise every entry.

export const defaultSeedImportTables = [
	"admin_users",
	"media_assets",
	"redirect_rules",
	"comments",
	"site_settings",
	"cms_route_groups",
	"cms_route_variants",
	"cms_route_aliases",
	"cms_route_revisions",
] as const;
