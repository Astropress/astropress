import { createAstropressAdminStoreAdapter } from "./admin-store-adapter-factory";
import {
  type AstropressSqliteDatabaseLike,
} from "./sqlite-runtime/utils";
import { createSqliteAuthStore } from "./sqlite-runtime/auth";
import { createSqliteSettingsStore } from "./sqlite-runtime/settings";
import { createSqliteContentStore } from "./sqlite-runtime/content";
import { createSqliteCatalogStore } from "./sqlite-runtime/catalog";
import { createSqliteRoutesStore } from "./sqlite-runtime/routes";
import { createSqliteAssetsStore } from "./sqlite-runtime/assets";
import { createApiTokenStore } from "./sqlite-runtime/api-tokens";
import { createWebhookStore } from "./sqlite-runtime/webhooks";
import type { SiteSettings } from "./site-settings";
import type { AdminStoreAdapter, ContentRecord, SessionUser } from "./persistence-types";

type AdminRole = SessionUser["role"];

interface Actor extends SessionUser {}

interface PasswordResetTokenRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface UserInviteRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export { AstropressSqliteDatabaseLike };

export interface AstropressSqliteAdminRuntimeOptions {
  getDatabase(): AstropressSqliteDatabaseLike;
  sessionTtlMs?: number;
  now?: () => number;
  randomId?: () => string;
}

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createAstropressSqliteAdminRuntime(options: AstropressSqliteAdminRuntimeOptions) {
  const getDb = options.getDatabase;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());

  const { sqliteUserRepository, sqliteAuthRepository, getPersistedAuditEvents } = createSqliteAuthStore(
    getDb,
    { sessionTtlMs, now, randomId },
  );
  const { sqliteRedirectRepository, sqliteCommentRepository, sqliteTranslationRepository, sqliteSettingsRepository } = createSqliteSettingsStore(getDb);

  const { sqliteContentRepository, sqliteSubmissionRepository, sqliteSchedulingRepository } = createSqliteContentStore(getDb, randomId);

  const { sqliteCmsRouteRegistry, sqliteCmsRegistryModule } = createSqliteRoutesStore(getDb, randomId);

  const { sqliteAuthorRepository, sqliteTaxonomyRepository } = createSqliteCatalogStore(getDb);
  const { sqliteRateLimitRepository, sqliteMediaRepository } = createSqliteAssetsStore(getDb, now);
  const sqliteApiTokenStore = createApiTokenStore(getDb());
  const sqliteWebhookStore = createWebhookStore(getDb());



  const sqliteAdminStore: AdminStoreAdapter = createAstropressAdminStoreAdapter("sqlite", {
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
  });

  return {
    sqliteAdminStore,
    sqliteCmsRegistryModule,
    authenticatePersistedAdminUser: sqliteAuthRepository.authenticatePersistedAdminUser,
  };
}
