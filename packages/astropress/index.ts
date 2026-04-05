// Core configuration seam
export { registerCms, getCmsConfig } from "./src/config";
export type { CmsConfig } from "./src/config";
export {
  ASTROPRESS_ADMIN_APP_NAME,
  ASTROPRESS_ADMIN_PRODUCT_NAME,
  buildAstropressAdminDocumentTitle,
} from "./src/admin-branding.js";
export {
  ASTROPRESS_ADMIN_BASE_PATH,
  createAstropressAdminRouteInjectionPlan,
  injectAstropressAdminRoutes,
  listAstropressAdminRoutes,
  resolveAstropressAdminRouteEntrypoints,
} from "./src/admin-routes.js";
export type { AstropressAdminRouteDefinition, AstropressAdminRouteInjector, AstropressAdminRouteKind } from "./src/admin-routes";

// Platform contracts
export {
  normalizeProviderCapabilities,
  assertProviderContract,
} from "./src/platform-contracts";
export type {
  ProviderKind,
  ProviderCapabilities,
  ContentStoreRecord,
  ContentStore,
  MediaAssetRecord,
  MediaStore,
  RevisionRecord,
  RevisionStore,
  AuthUser,
  AuthStore,
  GitSyncAdapter,
  DeployTarget,
  ImportSource,
  PreviewSession,
  AstropressPlatformAdapter,
} from "./src/platform-contracts";
export { listFirstPartyProviderTargets, getFirstPartyProviderTarget } from "./src/provider-targets";
export type { FirstPartyProviderTarget } from "./src/provider-targets";
export { createAstropressInMemoryPlatformAdapter } from "./src/in-memory-platform-adapter.js";
export type { AstropressInMemoryPlatformAdapterOptions } from "./src/in-memory-platform-adapter";
export { createAstropressProjectScaffold } from "./src/project-scaffold.js";
export type { AstropressProjectScaffold, AstropressScaffoldProvider } from "./src/project-scaffold";
export {
  resolveAstropressDeployTarget,
  resolveAstropressHostedProviderFromEnv,
  resolveAstropressLocalProviderFromEnv,
  resolveAstropressProjectEnvContract,
} from "./src/project-env.js";
export type {
  AstropressDeployTargetEnv,
  AstropressHostedProviderEnv,
  AstropressLocalProviderEnv,
  AstropressProjectEnvContract,
} from "./src/project-env";
export { createAstropressHostedPlatformAdapter } from "./src/hosted-platform-adapter.js";
export type { AstropressHostedPlatformAdapterOptions } from "./src/hosted-platform-adapter";
export { createAstropressCloudflareAdapter } from "./src/adapters/cloudflare.js";
export type { AstropressCloudflareAdapterOptions } from "./src/adapters/cloudflare";
export {
  createAstropressHostedAdapter,
  resolveAstropressHostedProvider,
} from "./src/adapters/hosted.js";
export type { AstropressHostedAdapterOptions, AstropressHostedProviderKind } from "./src/adapters/hosted";
export { createAstropressSupabaseAdapter } from "./src/adapters/supabase.js";
export {
  createAstropressSupabaseHostedAdapter,
  readAstropressSupabaseHostedConfig,
} from "./src/adapters/supabase.js";
export type {
  AstropressSupabaseAdapterOptions,
  AstropressSupabaseHostedAdapterOptions,
  AstropressSupabaseHostedConfig,
} from "./src/adapters/supabase";
export { createAstropressRunwayAdapter } from "./src/adapters/runway.js";
export {
  createAstropressRunwayHostedAdapter,
  readAstropressRunwayHostedConfig,
} from "./src/adapters/runway.js";
export type {
  AstropressRunwayAdapterOptions,
  AstropressRunwayHostedAdapterOptions,
  AstropressRunwayHostedConfig,
} from "./src/adapters/runway";

// Persistence types
export type {
  AdminRole,
  ContentStatus,
  CommentStatus,
  CommentPolicy,
  TaxonomyKind,
  SessionUser,
  Actor,
  AuditEvent,
  RedirectRule,
  CommentRecord,
  ContentOverride,
  ContentRecord,
  ContentRevision,
  ContactSubmission,
  InviteRequest,
  PasswordResetRequest,
  ManagedAdminUser,
  MediaAsset,
  AuthorRecord,
  TaxonomyTerm,
  AdminStoreAdapter,
  AuditRepository,
  AuthRepository,
  AuthorRepository,
  ContentRepository,
  TaxonomyRepository,
  RedirectRepository,
  CommentRepository,
  SubmissionRepository,
  TranslationRepository,
  SettingsRepository,
  RateLimitRepository,
  MediaRepository,
  UserRepository,
} from "./src/persistence-types";

// Site settings
export { defaultSiteSettings } from "./src/site-settings";
export type { SiteSettings } from "./src/site-settings";

// Translation
export { normalizeTranslationState, isPublishedTranslationState, translationStates } from "./src/translation-state";
export type { TranslationState } from "./src/translation-state";

// D1 types
export type { D1DatabaseLike, D1PreparedStatement, D1Result } from "./src/d1-database";
export type { D1AdminReadStore, D1AdminMutationStore } from "./src/d1-admin-store";
export { createD1AdminReadStore, createD1AdminMutationStore } from "./src/d1-admin-store";

// Runtime environment
export {
  getRuntimeEnv,
  isProductionRuntime,
  getCloudflareBindings,
  getStringRuntimeValue,
  getNewsletterConfig,
  getTransactionalEmailConfig,
  getAdminBootstrapConfig,
  getLoginSecurityConfig,
  getTurnstileSiteKey,
} from "./src/runtime-env";
export type { RuntimeBindings, R2BucketLike, R2ObjectBodyLike } from "./src/runtime-env";

// Page store (read + rate limits)
export {
  getRuntimeSettings,
  getRuntimeContentStateByPath,
  getRuntimeRedirectRules,
  listRuntimeContentStates,
  getRuntimeAuthors,
  getRuntimeCategories,
  getRuntimeTags,
  getRuntimeComments,
  getRuntimeAuditEvents,
  getRuntimeAdminUsers,
  getRuntimeMediaAssets,
  getRuntimeContentState,
  getRuntimeContentRevisions,
  getRuntimeTranslationState,
  getRuntimeContactSubmissions,
  checkRuntimeRateLimit,
  peekRuntimeRateLimit,
  recordRuntimeFailedAttempt,
  submitRuntimeContact,
  submitRuntimePublicComment,
} from "./src/runtime-page-store";

// Route registry
export {
  getRuntimeStructuredPageRoute,
  getRuntimeArchiveRoute,
  getRuntimeSystemRoute,
  listRuntimeStructuredPageRoutes,
  listRuntimeSystemRoutes,
  saveRuntimeArchiveRoute,
  saveRuntimeSystemRoute,
  createRuntimeStructuredPageRoute,
  saveRuntimeStructuredPageRoute,
} from "./src/runtime-route-registry";

// Admin actions (write)
export {
  createRuntimeContentRecord,
  saveRuntimeContentState,
  restoreRuntimeRevision,
  deleteRuntimeRedirectRule,
  createRuntimeRedirectRule,
  saveRuntimeSettings,
  updateRuntimeTranslationState,
  getRuntimeInviteRequest,
  getRuntimePasswordResetRequest,
  inviteRuntimeAdminUser,
  consumeRuntimeInviteToken,
  createRuntimePasswordResetToken,
  consumeRuntimePasswordResetToken,
  createRuntimeMediaAsset,
  updateRuntimeMediaAsset,
  deleteRuntimeMediaAsset,
  createRuntimeAuthor,
  updateRuntimeAuthor,
  deleteRuntimeAuthor,
  createRuntimeCategory,
  updateRuntimeCategory,
  deleteRuntimeCategory,
  createRuntimeTag,
  updateRuntimeTag,
  deleteRuntimeTag,
  moderateRuntimeComment,
  suspendRuntimeAdminUser,
  unsuspendRuntimeAdminUser,
} from "./src/runtime-admin-actions";

// Admin auth
export {
  getRuntimeSessionUser,
  getRuntimeCsrfToken,
  createRuntimeSession,
  revokeRuntimeSession,
  authenticateRuntimeAdminUser,
  recordRuntimeSuccessfulLogin,
  recordRuntimeLogout,
} from "./src/runtime-admin-auth";

// Admin page model builders
export { buildAdminDashboardModel } from "./src/admin-dashboard";
export type { AdminDashboardModel } from "./src/admin-dashboard";
export {
  buildAdminDashboardPageModel,
  buildPagesIndexPageModel,
  buildPostsIndexPageModel,
  buildPostEditorPageModel,
  buildPostRevisionsPageModel,
  buildRouteTablePageModel,
  buildRoutePageEditorModel,
  buildArchivesIndexPageModel,
  buildArchiveEditorModel,
  buildSeoPageModel,
  buildMediaPageModel,
  buildRedirectsPageModel,
  buildAuthorsPageModel,
  buildTaxonomiesPageModel,
  buildCommentsPageModel,
  buildTranslationsPageModel,
  buildSettingsPageModel,
  buildSystemPageModel,
  buildUsersPageModel,
  buildAcceptInvitePageModel,
  buildResetPasswordPageModel,
} from "./src/admin-page-models";
export type { AdminPageResult } from "./src/admin-page-models";

// Admin form utilities
export {
  withAdminFormAction,
  requireAdminFormAction,
  actionRedirect,
  actionErrorRedirect,
} from "./src/admin-action-utils";

// Path utilities
export { resolveSafeReturnPath, appendQueryParam } from "./src/return-path";

// Locale / i18n utilities
export {
  getAlternateLinksForEnglishRoute,
  sanitizeCanonicalUrl,
  canonicalUrlForRoute,
  getLocaleSwitchTargets,
} from "./src/locale-links";
export { getAdminLocalePair } from "./src/admin-locale-links";
export type { AdminLocalePair } from "./src/admin-locale-links";

// Vite integration helpers
export {
  isAstropressLocalRuntimeModuleRequest,
  createAstropressLocalRuntimeModulePlugin,
  createAstropressViteAliases,
} from "./src/vite-runtime-alias";
export type {
  AstropressViteRuntimeAliasOptions,
  AstropressVitePlugin,
  AstropressViteAlias,
} from "./src/vite-runtime-alias";
export { createAstropressVitestLocalRuntimePlugins } from "./src/vitest-runtime-alias";
export type { AstropressVitestPlugin } from "./src/vitest-runtime-alias";
export { defineAstropressHostRuntimeModules } from "./src/host-runtime-modules";
export type { AstropressHostRuntimeModules } from "./src/host-runtime-modules";
export type {
  LocalAdminStoreModule,
  LocalAdminAuthModule,
  LocalCmsRegistryModule,
  LocalMediaStorageModule,
  LocalImageStorageModule,
} from "./src/local-runtime-modules";

// Content utilities
export { sanitizeHtml } from "./src/html-sanitization";
export { optimizeImageLoading } from "./src/html-optimization";
export { isSeededPostRecord, isSeededPageRecord, getSeededAdminContentType } from "./src/seeded-content-type";
export type { SeededContentRecordLike, SeededAdminContentType } from "./src/seeded-content-type";

// Media
export {
  resolveMediaUrl,
  resolveRuntimeMediaUrl,
  getRuntimeMediaResolutionOptions,
} from "./src/media";
export type { MediaRecord } from "./src/media";
export { guessMediaMimeType } from "./src/local-media-storage";
export { guessImageMimeType } from "./src/local-image-storage";
export { storeRuntimeMediaObject, deleteRuntimeMediaObject } from "./src/runtime-media-storage";

// Newsletter
export { newsletterAdapter, placeholderAdapter } from "./src/newsletter-adapter";
export type { NewsletterAdapter } from "./src/newsletter-adapter";

// Email
export {
  sendTransactionalEmail,
  sendPasswordResetEmail,
  sendUserInviteEmail,
  sendContactNotification,
} from "./src/transactional-email";

// Turnstile
export { isTurnstileEnabled, verifyTurnstileToken } from "./src/turnstile";

// Crypto
export { hashPassword, verifyPassword } from "./src/crypto-utils";

// Local image storage (dev only)
export { readLocalImageAsset, resolveLocalImageDiskPath } from "./src/local-image-storage";
