import type { defaultSiteSettings } from "./site-settings";

export interface SqliteStatementLike {
	run(...params: unknown[]): { changes?: number | bigint };
	get(...params: unknown[]): unknown;
	all(...params: unknown[]): unknown[];
}

export interface SqliteDatabaseLike {
	exec(sql: string): void;
	prepare(sql: string): SqliteStatementLike;
	close(): void;
}

export type AdminRole = "admin" | "editor";

export interface MediaSeedRecord {
	id: string;
	sourceUrl?: string;
	localPath?: string;
	r2Key?: string;
}
export interface RedirectRuleSeed {
	sourcePath: string;
	targetPath: string;
	statusCode: 301 | 302;
}

export interface SeededComment {
	id: string;
	author: string;
	email?: string;
	body?: string;
	route: string;
	status: "pending" | "approved" | "rejected";
	policy: "legacy-readonly" | "disabled" | "open-moderated";
	submittedAt?: string;
}

export interface BootstrapUserSeed {
	email: string;
	password: string;
	role: AdminRole;
	name: string;
}

export interface SystemRouteSeed {
	groupId: string;
	variantId: string;
	path: string;
	title: string;
	summary?: string;
	bodyHtml?: string;
	renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
	settingsJson?: string;
	metaDescription?: string;
	robotsDirective?: string;
}

export interface ArchiveSeedRecord {
	legacyUrl: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
}

export interface MarketingRouteSeedRecord {
	path: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	ogImage?: string;
	templateKey: string;
	alternateLinks?: Array<{ hreflang: string; href: string }>;
	sections: Record<string, unknown> | null;
}

export interface SiteSettingsSeed {
	siteTitle: string;
	siteTagline: string;
	donationUrl: string;
	newsletterEnabled: boolean;
	commentsDefaultPolicy: (typeof defaultSiteSettings)["commentsDefaultPolicy"];
}

export interface SeedDatabaseOptions {
	db?: SqliteDatabaseLike;
	dbPath?: string;
	reset?: boolean;
	workspaceRoot?: string;
}

export interface SeedSummary {
	bootstrapUsers: number;
	mediaAssets: number;
	redirectRules: number;
	comments: number;
	siteSettings: number;
	systemRoutes: number;
	archiveRoutes: number;
	marketingRoutes: number;
}

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

export interface SeedImportStatement<
	TableName extends string = (typeof defaultSeedImportTables)[number],
> {
	table: TableName;
	statements: string[];
	sql: string;
}

export interface AstropressSqliteSeedToolkitOptions<
	TableName extends string = (typeof defaultSeedImportTables)[number],
> {
	readSchemaSql(): string;
	loadBootstrapUsers(): BootstrapUserSeed[];
	loadMediaSeeds(workspaceRoot: string): MediaSeedRecord[];
	redirectRules: RedirectRuleSeed[];
	comments: SeededComment[];
	systemRoutes: SystemRouteSeed[];
	archiveRoutes: ArchiveSeedRecord[];
	marketingRoutes: MarketingRouteSeedRecord[];
	siteSettings: SiteSettingsSeed;
	seedImportTables?: readonly TableName[];
	getDefaultAdminDbPath?(workspaceRoot?: string): string;
}

export interface AstropressSqliteSeedToolkit<
	TableName extends string = (typeof defaultSeedImportTables)[number],
> {
	getDefaultAdminDbPath(workspaceRoot?: string): string;
	applyCommittedSchema(db: SqliteDatabaseLike): void;
	openSeedDatabase(dbPath: string): SqliteDatabaseLike;
	seedDatabase(options?: SeedDatabaseOptions): SeedSummary;
	buildSeedImportSql(workspaceRoot?: string): string;
	buildSeedImportStatements(
		workspaceRoot?: string,
		seededDb?: SqliteDatabaseLike,
	): SeedImportStatement<TableName>[];
}

export type AstropressRollbackStatus =
	| "no_migrations"
	| "no_rollback_sql"
	| "dry_run"
	| "rolled_back";

export interface AstropressRollbackResult {
	migrationName: string | null;
	status: AstropressRollbackStatus;
	dryRun: boolean;
}
