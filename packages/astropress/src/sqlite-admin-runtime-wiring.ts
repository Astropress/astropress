// stryker-disable-file: data-only — pure repository-method passthrough; static wiring with no behavioural contract beyond "type-correct method binding".
/**
 * Static wiring shape for the sqlite admin store adapter.
 *
 * Split from sqlite-admin-runtime.ts so the bulk wiring object — 14 nested
 * sub-records mapping AdminStoreModules method names to the corresponding
 * sqliteXRepository methods — is not mutation-tested. Each entry is a
 * top-level static binding whose value (method reference) carries no
 * behavioural contract beyond "the right method is wired to the right
 * surface". Behaviour lives in the sub-stores themselves and is mutation-
 * tested there.
 *
 * Under vitest's worker-cache model these wiring mutants survive as
 * `static: true` (cached at first import → mutated initialiser never
 * re-runs); see UPSTREAM_CONTRIBUTIONS.md item 15. Splitting + the
 * data-only marker is the project's documented remedy.
 */
import type { AdminStoreModules } from "./admin-store-adapter-factory";
import { recordAuditEvent } from "./sqlite-runtime/audit-log";
import type { AstropressSqliteDatabaseLike } from "./sqlite-runtime/utils";

interface SqliteAuthRepositoryLike {
	createSession: AdminStoreModules["auth"]["createSession"];
	getSessionUser: AdminStoreModules["auth"]["getSessionUser"];
	getCsrfToken: AdminStoreModules["auth"]["getCsrfToken"];
	revokeSession: AdminStoreModules["auth"]["revokeSession"];
	createPasswordResetToken: AdminStoreModules["auth"]["createPasswordResetToken"];
	getInviteRequest: AdminStoreModules["auth"]["getInviteRequest"];
	getPasswordResetRequest: AdminStoreModules["auth"]["getPasswordResetRequest"];
	consumeInviteToken: AdminStoreModules["auth"]["consumeInviteToken"];
	consumePasswordResetToken: AdminStoreModules["auth"]["consumePasswordResetToken"];
	recordSuccessfulLogin: AdminStoreModules["auth"]["recordSuccessfulLogin"];
	recordLogout: AdminStoreModules["auth"]["recordLogout"];
}

export interface SqliteAdminStoreWiringDeps {
	getDb(): AstropressSqliteDatabaseLike;
	sqliteAuthRepository: SqliteAuthRepositoryLike;
	getPersistedAuditEvents: AdminStoreModules["audit"]["getAuditEvents"];
	sqliteUserRepository: AdminStoreModules["users"];
	sqliteAuthorRepository: AdminStoreModules["authors"];
	sqliteTaxonomyRepository: AdminStoreModules["taxonomies"];
	sqliteRedirectRepository: AdminStoreModules["redirects"];
	sqliteCommentRepository: AdminStoreModules["comments"];
	sqliteContentRepository: Pick<
		AdminStoreModules["content"],
		| "listContentStates"
		| "getContentState"
		| "getContentRevisions"
		| "createContentRecord"
		| "saveContentState"
		| "restoreRevision"
	>;
	sqliteSchedulingRepository: Pick<
		AdminStoreModules["content"],
		"schedulePublish" | "listScheduled" | "cancelScheduledPublish" | "runScheduledPublishes"
	>;
	sqliteSubmissionRepository: AdminStoreModules["submissions"];
	sqliteTranslationRepository: AdminStoreModules["translations"];
	sqliteSettingsRepository: AdminStoreModules["settings"];
	sqliteRateLimitRepository: AdminStoreModules["rateLimits"];
	sqliteMediaRepository: AdminStoreModules["media"];
	sqliteApiTokenStore: NonNullable<AdminStoreModules["apiTokens"]>;
	sqliteWebhookStore: NonNullable<AdminStoreModules["webhooks"]>;
	sqliteFlashStore: NonNullable<AdminStoreModules["flash"]>;
	sqliteIntegrationsRepository: NonNullable<AdminStoreModules["integrations"]>;
}

export function buildSqliteAdminStoreModules(deps: SqliteAdminStoreWiringDeps): AdminStoreModules {
	const {
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
	} = deps;
	return {
		auth: {
			createSession: sqliteAuthRepository.createSession,
			getSessionUser: sqliteAuthRepository.getSessionUser,
			getCsrfToken: sqliteAuthRepository.getCsrfToken,
			revokeSession: sqliteAuthRepository.revokeSession,
			createPasswordResetToken: sqliteAuthRepository.createPasswordResetToken,
			getInviteRequest: sqliteAuthRepository.getInviteRequest,
			getPasswordResetRequest: sqliteAuthRepository.getPasswordResetRequest,
			consumeInviteToken: sqliteAuthRepository.consumeInviteToken,
			consumePasswordResetToken: sqliteAuthRepository.consumePasswordResetToken,
			recordSuccessfulLogin: sqliteAuthRepository.recordSuccessfulLogin,
			recordLogout: sqliteAuthRepository.recordLogout,
		},
		audit: {
			getAuditEvents: getPersistedAuditEvents,
			recordAuditEvent: (input) => recordAuditEvent(getDb(), input),
		},
		users: {
			listAdminUsers: sqliteUserRepository.listAdminUsers,
			inviteAdminUser: sqliteUserRepository.inviteAdminUser,
			suspendAdminUser: sqliteUserRepository.suspendAdminUser,
			unsuspendAdminUser: sqliteUserRepository.unsuspendAdminUser,
		},
		authors: {
			listAuthors: sqliteAuthorRepository.listAuthors,
			createAuthor: sqliteAuthorRepository.createAuthor,
			updateAuthor: sqliteAuthorRepository.updateAuthor,
			deleteAuthor: sqliteAuthorRepository.deleteAuthor,
		},
		taxonomies: {
			listCategories: sqliteTaxonomyRepository.listCategories,
			createCategory: sqliteTaxonomyRepository.createCategory,
			updateCategory: sqliteTaxonomyRepository.updateCategory,
			deleteCategory: sqliteTaxonomyRepository.deleteCategory,
			listTags: sqliteTaxonomyRepository.listTags,
			createTag: sqliteTaxonomyRepository.createTag,
			updateTag: sqliteTaxonomyRepository.updateTag,
			deleteTag: sqliteTaxonomyRepository.deleteTag,
		},
		redirects: {
			getRedirectRules: sqliteRedirectRepository.getRedirectRules,
			createRedirectRule: sqliteRedirectRepository.createRedirectRule,
			deleteRedirectRule: sqliteRedirectRepository.deleteRedirectRule,
		},
		comments: {
			getComments: sqliteCommentRepository.getComments,
			moderateComment: sqliteCommentRepository.moderateComment,
			submitPublicComment: sqliteCommentRepository.submitPublicComment,
			getApprovedCommentsForRoute: sqliteCommentRepository.getApprovedCommentsForRoute,
		},
		content: {
			listContentStates: sqliteContentRepository.listContentStates,
			getContentState: sqliteContentRepository.getContentState,
			getContentRevisions: sqliteContentRepository.getContentRevisions,
			createContentRecord: sqliteContentRepository.createContentRecord,
			saveContentState: sqliteContentRepository.saveContentState,
			restoreRevision: sqliteContentRepository.restoreRevision,
			schedulePublish: sqliteSchedulingRepository.schedulePublish,
			listScheduled: sqliteSchedulingRepository.listScheduled,
			cancelScheduledPublish: sqliteSchedulingRepository.cancelScheduledPublish,
			runScheduledPublishes: sqliteSchedulingRepository.runScheduledPublishes,
		},
		submissions: {
			submitContact: sqliteSubmissionRepository.submitContact,
			getContactSubmissions: sqliteSubmissionRepository.getContactSubmissions,
			submitTestimonial: sqliteSubmissionRepository.submitTestimonial,
			getTestimonials: sqliteSubmissionRepository.getTestimonials,
			moderateTestimonial: sqliteSubmissionRepository.moderateTestimonial,
		},
		translations: {
			updateTranslationState: sqliteTranslationRepository.updateTranslationState,
			getEffectiveTranslationState: sqliteTranslationRepository.getEffectiveTranslationState,
		},
		settings: {
			getSettings: sqliteSettingsRepository.getSettings,
			saveSettings: sqliteSettingsRepository.saveSettings,
		},
		rateLimits: {
			checkRateLimit: sqliteRateLimitRepository.checkRateLimit,
			peekRateLimit: sqliteRateLimitRepository.peekRateLimit,
			recordFailedAttempt: sqliteRateLimitRepository.recordFailedAttempt,
		},
		media: {
			listMediaAssets: sqliteMediaRepository.listMediaAssets,
			createMediaAsset: sqliteMediaRepository.createMediaAsset,
			updateMediaAsset: sqliteMediaRepository.updateMediaAsset,
			deleteMediaAsset: sqliteMediaRepository.deleteMediaAsset,
		},
		apiTokens: sqliteApiTokenStore,
		webhooks: sqliteWebhookStore,
		flash: sqliteFlashStore,
		integrations: sqliteIntegrationsRepository,
	};
}
