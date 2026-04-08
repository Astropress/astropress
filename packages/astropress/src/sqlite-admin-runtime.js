// packages/astropress/src/sqlite-admin-runtime.ts

import { createSqliteAuthStore } from "./sqlite-runtime/auth.js";
import { createSqliteSettingsStore } from "./sqlite-runtime/settings.js";
import { createSqliteContentStore } from "./sqlite-runtime/content.js";
import { createSqliteCatalogStore } from "./sqlite-runtime/catalog.js";
import { createSqliteRoutesStore } from "./sqlite-runtime/routes.js";
import { createSqliteAssetsStore } from "./sqlite-runtime/assets.js";

// packages/astropress/src/admin-store-adapter-factory.ts
function createAstropressAdminStoreAdapter(backend, modules) {
  return {
    backend,
    ...modules
  };
}




// packages/astropress/src/sqlite-admin-runtime.ts
var DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
function createAstropressSqliteAdminRuntime(options) {
  const getDb = options.getDatabase;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const { sqliteUserRepository, sqliteAuthRepository, getPersistedAuditEvents } = createSqliteAuthStore(getDb, { sessionTtlMs, now, randomId });
  const { sqliteRedirectRepository, sqliteCommentRepository, sqliteTranslationRepository, sqliteSettingsRepository } = createSqliteSettingsStore(getDb);
  const { sqliteContentRepository, sqliteSubmissionRepository } = createSqliteContentStore(getDb, randomId);
  const { sqliteCmsRouteRegistry, sqliteCmsRegistryModule } = createSqliteRoutesStore(getDb, randomId);

  const { sqliteAuthorRepository, sqliteTaxonomyRepository } = createSqliteCatalogStore(getDb);
  const { sqliteRateLimitRepository, sqliteMediaRepository } = createSqliteAssetsStore(getDb, now);


  const sqliteAdminStore = createAstropressAdminStoreAdapter("sqlite", {
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
      recordLogout: sqliteAuthRepository.recordLogout
    },
    audit: {
      getAuditEvents: getPersistedAuditEvents
    },
    users: {
      listAdminUsers: sqliteUserRepository.listAdminUsers,
      inviteAdminUser: sqliteUserRepository.inviteAdminUser,
      suspendAdminUser: sqliteUserRepository.suspendAdminUser,
      unsuspendAdminUser: sqliteUserRepository.unsuspendAdminUser
    },
    authors: {
      listAuthors: sqliteAuthorRepository.listAuthors,
      createAuthor: sqliteAuthorRepository.createAuthor,
      updateAuthor: sqliteAuthorRepository.updateAuthor,
      deleteAuthor: sqliteAuthorRepository.deleteAuthor
    },
    taxonomies: {
      listCategories: sqliteTaxonomyRepository.listCategories,
      createCategory: sqliteTaxonomyRepository.createCategory,
      updateCategory: sqliteTaxonomyRepository.updateCategory,
      deleteCategory: sqliteTaxonomyRepository.deleteCategory,
      listTags: sqliteTaxonomyRepository.listTags,
      createTag: sqliteTaxonomyRepository.createTag,
      updateTag: sqliteTaxonomyRepository.updateTag,
      deleteTag: sqliteTaxonomyRepository.deleteTag
    },
    redirects: {
      getRedirectRules: sqliteRedirectRepository.getRedirectRules,
      createRedirectRule: sqliteRedirectRepository.createRedirectRule,
      deleteRedirectRule: sqliteRedirectRepository.deleteRedirectRule
    },
    comments: {
      getComments: sqliteCommentRepository.getComments,
      moderateComment: sqliteCommentRepository.moderateComment,
      submitPublicComment: sqliteCommentRepository.submitPublicComment,
      getApprovedCommentsForRoute: sqliteCommentRepository.getApprovedCommentsForRoute
    },
    content: {
      listContentStates: sqliteContentRepository.listContentStates,
      getContentState: sqliteContentRepository.getContentState,
      getContentRevisions: sqliteContentRepository.getContentRevisions,
      createContentRecord: sqliteContentRepository.createContentRecord,
      saveContentState: sqliteContentRepository.saveContentState,
      restoreRevision: sqliteContentRepository.restoreRevision
    },
    submissions: {
      submitContact: sqliteSubmissionRepository.submitContact,
      getContactSubmissions: sqliteSubmissionRepository.getContactSubmissions
    },
    translations: {
      updateTranslationState: sqliteTranslationRepository.updateTranslationState,
      getEffectiveTranslationState: sqliteTranslationRepository.getEffectiveTranslationState
    },
    settings: {
      getSettings: sqliteSettingsRepository.getSettings,
      saveSettings: sqliteSettingsRepository.saveSettings
    },
    rateLimits: {
      checkRateLimit: sqliteRateLimitRepository.checkRateLimit,
      peekRateLimit: sqliteRateLimitRepository.peekRateLimit,
      recordFailedAttempt: sqliteRateLimitRepository.recordFailedAttempt
    },
    media: {
      listMediaAssets: sqliteMediaRepository.listMediaAssets,
      createMediaAsset: sqliteMediaRepository.createMediaAsset,
      updateMediaAsset: sqliteMediaRepository.updateMediaAsset,
      deleteMediaAsset: sqliteMediaRepository.deleteMediaAsset
    }
  });
  return {
    sqliteAdminStore,
    sqliteCmsRegistryModule,
    authenticatePersistedAdminUser: sqliteAuthRepository.authenticatePersistedAdminUser
  };
}
export {
  createAstropressSqliteAdminRuntime
};
