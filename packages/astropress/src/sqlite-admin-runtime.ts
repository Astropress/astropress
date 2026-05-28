import { createAstropressAdminStoreAdapter } from "./admin-store-adapter-factory";
import { peekCmsConfig } from "./config";
import type { AdminStoreAdapter } from "./persistence-types";
import {
	resolveAstropressSqliteAdminRuntimeOptions,
	resolveIntegrationsRepositoryOptions,
} from "./sqlite-admin-runtime-options";
import { buildSqliteAdminStoreModules } from "./sqlite-admin-runtime-wiring";
import { createApiTokenStore } from "./sqlite-runtime/api-tokens";
import { createSqliteAssetsStore } from "./sqlite-runtime/assets";
import { createSqliteAuthStore } from "./sqlite-runtime/auth";
import { createSqliteCatalogStore } from "./sqlite-runtime/catalog";
import { createSqliteContentStore } from "./sqlite-runtime/content";
import { createFlashStore } from "./sqlite-runtime/flash";
import { createIntegrationsRepository } from "./sqlite-runtime/integrations";
import { createSqliteLocksOps } from "./sqlite-runtime/locks";
import { createSqlitePurgeOps } from "./sqlite-runtime/purge";
import { createSqliteRoutesStore } from "./sqlite-runtime/routes";
import { searchContentOverrides } from "./sqlite-runtime/search";
import { createSqliteSettingsStore } from "./sqlite-runtime/settings";
import type { AstropressSqliteDatabaseLike } from "./sqlite-runtime/utils";
import { createWebhookStore } from "./sqlite-runtime/webhooks";
import { ensureFts5SearchIndex } from "./sqlite-schema-compat";

export type { AstropressSqliteDatabaseLike };

export interface AstropressSqliteAdminRuntimeOptions {
	getDatabase(): AstropressSqliteDatabaseLike;
	sessionTtlMs?: number;
	now?: () => number;
	randomId?: () => string;
	rootSecret?: string;
}

export function createAstropressSqliteAdminRuntime(options: AstropressSqliteAdminRuntimeOptions) {
	const { getDb, sessionTtlMs, now, randomId, rootSecret } =
		resolveAstropressSqliteAdminRuntimeOptions(options);

	const { sqliteUserRepository, sqliteAuthRepository, getPersistedAuditEvents } =
		createSqliteAuthStore(getDb, { sessionTtlMs, now, randomId, rootSecret });
	const {
		sqliteRedirectRepository,
		sqliteCommentRepository,
		sqliteTranslationRepository,
		sqliteSettingsRepository,
	} = createSqliteSettingsStore(getDb);

	const { sqliteContentRepository, sqliteSubmissionRepository, sqliteSchedulingRepository } =
		createSqliteContentStore(getDb, randomId);

	const { sqliteCmsRegistryModule } = createSqliteRoutesStore(getDb, randomId);

	const { sqliteAuthorRepository, sqliteTaxonomyRepository } = createSqliteCatalogStore(getDb);
	const { sqliteRateLimitRepository, sqliteMediaRepository } = createSqliteAssetsStore(getDb, now);
	const sqliteApiTokenStore = createApiTokenStore(getDb());
	const sqliteWebhookStore = createWebhookStore(getDb());
	const sqliteFlashStore = createFlashStore(getDb());
	const sqliteLocksOps = createSqliteLocksOps(getDb);
	const sqlitePurgeOps = createSqlitePurgeOps(getDb);
	const sqliteIntegrationsRepository = createIntegrationsRepository(
		resolveIntegrationsRepositoryOptions({ getDb, now }),
	);

	const sqliteAdminStore: AdminStoreAdapter = createAstropressAdminStoreAdapter(
		"sqlite",
		buildSqliteAdminStoreModules({
			getDb,
			sqliteAuthRepository,
			getPersistedAuditEvents,
			sqliteUserRepository,
			sqliteAuthorRepository,
			sqliteTaxonomyRepository,
			sqliteRedirectRepository,
			sqliteCommentRepository,
			sqliteContentRepository,
			sqliteSchedulingRepository,
			sqliteSubmissionRepository,
			sqliteTranslationRepository,
			sqliteSettingsRepository,
			sqliteRateLimitRepository,
			sqliteMediaRepository,
			sqliteApiTokenStore,
			sqliteWebhookStore,
			sqliteFlashStore,
			sqliteIntegrationsRepository,
		}),
	);

	if (peekCmsConfig()?.search?.enabled) {
		ensureFts5SearchIndex(getDb());
	}

	return {
		sqliteAdminStore,
		sqliteCmsRegistryModule,
		authenticatePersistedAdminUser: sqliteAuthRepository.authenticatePersistedAdminUser,
		sqliteLocksOps,
		sqlitePurgeOps,
		searchContentStates: (query: string) => searchContentOverrides(getDb(), query),
	};
}
