// Package version
export const PROVIDER_CONTRACT_VERSION = "0.1";

// Integration helpers
export { createAstropressPublicSiteIntegration } from "./src/public-site-integration.js";
export type { AstropressPublicSiteOptions } from "./src/public-site-integration";

// Per-domain integration registry (Phase 3) — hosts call
// `registerNewsletter()` / `registerAnalytics()` / etc. from setup
// code; admin actions and runtime adapters look providers up by
// (domain, providerId).
export {
	registerProvider,
	getProvider,
	listProviders,
	IntegrationRegistryError,
	INTEGRATION_DOMAINS,
} from "./src/integrations/registry.js";
export type {
	IntegrationDomain,
	ProviderDefinition,
	RegisteredProvider,
} from "./src/integrations/registry";
export {
	registerNewsletter,
	registerAnalytics,
	registerAbTesting,
	registerSearch,
	registerCdnPurge,
	registerMonitoring,
	registerForms,
	registerDeployHooks,
} from "./src/integrations/domains.js";
export {
	connectIntegration,
	reverifyIntegration,
	runProviderVerify,
} from "./src/integrations/connect-flow.js";
export type {
	ConnectIntegrationParams,
	ConnectIntegrationResult,
} from "./src/integrations/connect-flow";
export {
	getConnectedProvider,
	createRequestProviderCache,
	listRegisteredProvidersForDomain,
} from "./src/integrations/runtime.js";
export type { ConnectedProvider } from "./src/integrations/runtime";

// Phase 4 push-button providers — hosts call these once at boot to
// register the corresponding registry entry. Each provider exports
// its Zod schema and verify() helper so admin pages can drive a
// connect form against the same shape the registry validates.
export {
	registerListmonk,
	verifyListmonk,
	LISTMONK_FIELDS,
	ListmonkVerifyError,
} from "./src/integrations/providers/listmonk.js";
export type { ListmonkFields } from "./src/integrations/providers/listmonk";
export {
	registerPlausible,
	verifyPlausible,
	PLAUSIBLE_FIELDS,
	PlausibleVerifyError,
} from "./src/integrations/providers/plausible.js";
export type { PlausibleFields } from "./src/integrations/providers/plausible";
export {
	registerCloudflareCdn,
	verifyCloudflareCdn,
	classifyCloudflareStatus,
	CLOUDFLARE_CDN_FIELDS,
	CloudflareCdnVerifyError,
} from "./src/integrations/providers/cloudflare-cdn.js";
export type { CloudflareCdnFields } from "./src/integrations/providers/cloudflare-cdn";
export {
	registerGithubDeploy,
	verifyGithubDeploy,
	classifyGithubStatus,
	GITHUB_DEPLOY_FIELDS,
	GithubDeployVerifyError,
} from "./src/integrations/providers/github-deploy.js";
export type { GithubDeployFields } from "./src/integrations/providers/github-deploy";

// Phase 6 OAuth state-token primitives (state issued at the start of
// authorization-code flows is HMAC-signed and self-describing).
export {
	issueOAuthState,
	verifyOAuthState,
	DEFAULT_OAUTH_STATE_TTL_MS,
} from "./src/integrations/oauth/state.js";
export type {
	OAuthStateContext,
	IssuedOAuthState,
	VerifyOAuthStateResult,
	VerifyOAuthStateErrorCode,
	IssueOAuthStateArgs,
	VerifyOAuthStateArgs,
} from "./src/integrations/oauth/state";

// Phase 6 inbound-webhook signature verifier (HMAC over raw request
// bytes; GitHub-style algorithm-prefixed headers supported).
export {
	verifyInboundWebhookSignature,
	verifyGithubWebhookSignature,
} from "./src/integrations/webhooks/inbound.js";
export type {
	InboundWebhookAlgorithm,
	VerifyInboundWebhookArgs,
} from "./src/integrations/webhooks/inbound";

// Phase 2 secret-store repository (status surface + sealed-secret
// surface). Hosts that need to read connected_integrations from
// outside the bundled admin actions construct the repo directly.
export { createIntegrationsRepository } from "./src/sqlite-runtime/integrations.js";
export type {
	IntegrationsRepository,
	IntegrationStatusRow,
	IntegrationStatusValue,
	ConnectIntegrationInput,
} from "./src/sqlite-runtime/integrations";

// Core configuration seam
export {
	registerCms,
	getCmsConfig,
	dispatchPluginContentEvent,
	dispatchPluginMediaEvent,
	validateContentFields,
} from "./src/config";
export type {
	AstropressPlugin,
	AstropressContentEvent,
	AstropressMediaEvent,
	FieldDefinition,
	ContentTypeDefinition,
} from "./src/config";
export type { CmsConfig, TestimonialsConfig } from "./src/config";
export {
	ASTROPRESS_ADMIN_APP_NAME,
	ASTROPRESS_ADMIN_PRODUCT_NAME,
	buildAstropressAdminDocumentTitle,
} from "./src/admin-branding.js";
export {
	getAdminLabel,
	resolveAstropressAdminUiConfig,
} from "./src/admin-ui.js";
export {
	ADMIN_STUB_PAGES,
	adminStubs,
	getAdminStubPage,
} from "./src/admin-stub-catalog.js";
export type {
	AdminStubKey,
	AdminStubPageEntry,
	AdminStubPageSlug,
	StubEntry,
	StubProvider,
} from "./src/admin-stub-catalog";

// Access control (ABAC engine + action registry + repository)
export {
	actionMatches,
	createAccessMiddleware,
	createAccessRepository,
	createPolicyEngine,
	evaluate,
	evaluateCondition,
	getAccessAction,
	getAccessContext,
	listAccessActions,
	registerAccessAction,
	requiresAccess,
	resolvePath,
	seedStarterRoles,
	substituteString,
} from "./src/access/index.js";
export {
	addRuntimeRolePolicy,
	addRuntimeUserDirectGrant,
	assertNotLastActiveAdmin,
	assignRuntimeUserRole,
	createRuntimeRole,
	deleteRuntimeRole,
	removeRuntimeRolePolicy,
	removeRuntimeUserDirectGrant,
	revokeRuntimeUserRole,
	updateRuntimeRole,
} from "./src/runtime-actions-access.js";
export { buildAccessPageModel } from "./src/admin-page-models-access.js";
export type {
	AccessPageModel,
	AccessPageTab,
} from "./src/admin-page-models-access";
export type {
	AccessContext,
	AccessRepository,
	AccessSnapshot,
	AccessStore,
	ActionDefinition,
	AttributeValue as AccessAttributeValue,
	BindingContext,
	Condition,
	Decision,
	Effect,
	Env as AccessEnv,
	EvaluationResult,
	JsonPolicyEngineOptions,
	LocalAccessStoreSurface,
	Policy,
	PolicyEngine,
	PolicyLoader,
	PolicySource,
	RequiresAccessOptions,
	Resource as AccessResource,
	RolePolicyRecord,
	RoleRecord,
	Subject as AccessSubject,
	UserPolicyRecord,
	UserRoleAssignment,
} from "./src/access/index";
export type {
	AstropressAdminNavKey,
	AstropressResolvedAdminUiConfig,
} from "./src/admin-ui";
export {
	resolveAdminLocale,
	pickAdminLocaleFromAcceptLanguage,
	ADMIN_LOCALE_COOKIE,
} from "./src/admin-locale.js";
export type { AdminLocale } from "./src/admin-labels";
export { getPageT, pageLabels } from "./src/admin-page-labels.js";
export type { PageLabelKey } from "./src/admin-page-labels";
export {
	invalidateAstropressAdminSlugCache,
	resolveAstropressAdminSlug,
} from "./src/admin-slug-cache";
export {
	ASTROPRESS_ADMIN_BASE_PATH,
	createAstropressAdminRouteInjectionPlan,
	injectAstropressAdminRoutes,
	listAstropressAdminRoutes,
	resolveAstropressAdminRouteEntrypoints,
} from "./src/admin-routes.js";
export type {
	AstropressAdminRouteDefinition,
	AstropressAdminRouteInjector,
	AstropressAdminRouteKind,
} from "./src/admin-routes";

// Build-time content loading
export { createAstropressBuildTimeLoader } from "./src/build-time-content-loader.js";
export type {
	AstropressBuildTimeLoaderOptions,
	AstropressContentLoader,
} from "./src/build-time-content-loader";

// Platform contracts
export {
	normalizeProviderCapabilities,
	assertProviderContract,
	isAuthUserAdmin,
} from "./src/platform-contracts";
export type {
	ProviderKind,
	ProviderCapabilities,
	AstropressCmsConfig,
	AstropressHostPanelCapability,
	SaveableContentKind,
	ReadableContentKind,
	ContentListOptions,
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
	AstropressWordPressImportArtifacts,
	AstropressWordPressImportEntityCount,
	AstropressWordPressImportInventory,
	AstropressWordPressImportLocalApplyReport,
	AstropressWordPressImportPlan,
	AstropressWordPressImportReport,
	PreviewSession,
	AstropressPlatformAdapter,
} from "./src/platform-contracts";
export {
	listFirstPartyProviderTargets,
	getFirstPartyProviderTarget,
} from "./src/provider-targets";
export type { FirstPartyProviderTarget } from "./src/provider-targets";
export {
	listAstropressAppHosts,
	getAstropressAppHostTarget,
} from "./src/app-host-targets";
export type {
	AstropressAppHost,
	AstropressAppHostTarget,
} from "./src/app-host-targets";
export {
	listAstropressDataServiceTargets,
	getAstropressDataServiceTarget,
} from "./src/data-service-targets";
export type {
	AstropressDataServices,
	AstropressDataServiceTarget,
} from "./src/data-service-targets";
export {
	listAstropressDeploymentMatrixEntries,
	getAstropressDeploymentMatrixEntry,
	resolveAstropressDeploymentSupportLevel,
} from "./src/deployment-matrix";
export type {
	AstropressDeploymentProfile,
	AstropressDeploymentMatrixEntry,
	AstropressDeploymentSupportLevel,
} from "./src/deployment-matrix";
export { createAstropressInMemoryPlatformAdapter } from "./src/in-memory-platform-adapter.js";
export type { AstropressInMemoryPlatformAdapterOptions } from "./src/in-memory-platform-adapter";
export { createAstropressProjectScaffold } from "./src/project-scaffold.js";
export type {
	AstropressProjectScaffold,
	AstropressScaffoldProvider,
	AstropressProjectScaffoldInput,
} from "./src/project-scaffold";
export { recommendAstropressProvider } from "./src/provider-choice.js";
export type {
	AstropressExistingPlatform,
	AstropressProviderChoiceInput,
	AstropressProviderChoiceRecommendation,
	AstropressProviderOpsComfort,
} from "./src/provider-choice";
export {
	resolveAstropressAppHostFromEnv,
	resolveAstropressDataServicesFromEnv,
	resolveAstropressDeployTarget,
	resolveAstropressHostedProviderFromEnv,
	resolveAstropressLocalProviderFromEnv,
	resolveAstropressProjectEnvContract,
	resolveAstropressServiceOriginFromEnv,
} from "./src/project-env.js";
export type {
	AstropressAppHostEnv,
	AstropressContentServicesEnv,
	AstropressDataServicesEnv,
	AstropressDeployTargetEnv,
	AstropressHostedProviderEnv,
	AstropressLocalProviderEnv,
	AstropressProjectEnvContract,
} from "./src/project-env";
export { createAstropressHostedPlatformAdapter } from "./src/hosted-platform-adapter.js";
export type { AstropressHostedPlatformAdapterOptions } from "./src/hosted-platform-adapter";
export { createAstropressHostedApiAdapter } from "./src/hosted-api-adapter.js";
export type { AstropressHostedApiAdapterOptions } from "./src/hosted-api-adapter";
export { createAstropressCloudflareAdapter } from "./src/adapters/cloudflare.js";
export type { AstropressCloudflareAdapterOptions } from "./src/adapters/cloudflare";
export {
	createAstropressHostedAdapter,
	resolveAstropressHostedProvider,
} from "./src/adapters/hosted.js";
export type {
	AstropressHostedAdapterOptions,
	AstropressHostedProviderKind,
} from "./src/adapters/hosted";
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
export { createAstropressAppwriteAdapter } from "./src/adapters/appwrite.js";
export {
	createAstropressAppwriteHostedAdapter,
	readAstropressAppwriteHostedConfig,
} from "./src/adapters/appwrite.js";
export type {
	AstropressAppwriteAdapterOptions,
	AstropressAppwriteHostedAdapterOptions,
	AstropressAppwriteHostedConfig,
} from "./src/adapters/appwrite";
export { createAstropressPocketbaseAdapter } from "./src/adapters/pocketbase.js";
export {
	createAstropressPocketbaseHostedAdapter,
	readAstropressPocketbaseHostedConfig,
} from "./src/adapters/pocketbase.js";
export type {
	AstropressPocketbaseAdapterOptions,
	AstropressPocketbaseHostedAdapterOptions,
	AstropressPocketbaseHostedConfig,
} from "./src/adapters/pocketbase";
export { createAstropressTursoAdapter } from "./src/adapters/turso.js";
export {
	createAstropressTursoHostedAdapter,
	readAstropressTursoHostedConfig,
} from "./src/adapters/turso.js";
export type {
	AstropressTursoAdapterOptions,
	AstropressTursoHostedAdapterOptions,
	AstropressTursoHostedConfig,
} from "./src/adapters/turso";
export { createAstropressNeonAdapter } from "./src/adapters/neon.js";
export {
	createAstropressNeonHostedAdapter,
	readAstropressNeonHostedConfig,
} from "./src/adapters/neon.js";
export type {
	AstropressNeonAdapterOptions,
	AstropressNeonHostedAdapterOptions,
	AstropressNeonHostedConfig,
} from "./src/adapters/neon";
export { createAstropressNhostAdapter } from "./src/adapters/nhost.js";
export {
	createAstropressNhostHostedAdapter,
	readAstropressNhostHostedConfig,
} from "./src/adapters/nhost.js";
export type {
	AstropressNhostAdapterOptions,
	AstropressNhostHostedAdapterOptions,
	AstropressNhostHostedConfig,
} from "./src/adapters/nhost";

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
	TestimonialStatus,
	TestimonialSource,
	TestimonialSubmission,
	TestimonialSubmissionInput,
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
export {
	normalizeTranslationState,
	isPublishedTranslationState,
	translationStates,
} from "./src/translation-state";
export type { TranslationState } from "./src/translation-state";

// D1 types
export type {
	D1DatabaseLike,
	D1PreparedStatement,
	D1Result,
} from "./src/d1-database";
export type {
	D1AdminReadStore,
	D1AdminMutationStore,
} from "./src/d1-admin-store";
export {
	createD1AdminReadStore,
	createD1AdminMutationStore,
} from "./src/d1-admin-store";

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
	getAstropressRootSecret,
	getAstropressRootSecretCandidates,
} from "./src/runtime-env";
export type {
	RuntimeBindings,
	R2BucketLike,
	R2ObjectBodyLike,
} from "./src/runtime-env";
export {
	applyAstropressSecurityHeaders,
	createAstropressSecureRedirect,
	createAstropressSecurityHeaders,
	isTrustedRequestOrigin,
	isTrustedStrictRequestOrigin,
} from "./src/security-headers.js";
export type {
	AstropressSecurityArea,
	AstropressSecurityHeadersOptions,
} from "./src/security-headers";
export {
	createAstropressSecurityMiddleware,
	resolveAstropressSecurityArea,
} from "./src/security-middleware.js";
export type { AstropressSecurityMiddlewareOptions } from "./src/security-middleware";

// Page store (read + rate limits)
export {
	getRuntimeSettings,
	getRuntimeContentStateByPath,
	getRuntimeRedirectRules,
	listRuntimeContentStates,
	searchRuntimeContentStates,
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
export { moderateRuntimeTestimonial } from "./src/runtime-mutation-store";

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
	buildTestimonialsPageModel,
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

// Publish action
export {
	triggerPublish,
	resolveDeployHookFromEnv,
} from "./src/admin-action-publish.js";
export type {
	PublishTriggerResult,
	DeployHookType,
	DeployHookConfig,
} from "./src/admin-action-publish";

// Preview middleware helpers
export {
	resolvePreviewPath,
	buildPreviewLoginRedirect,
} from "./src/admin-preview-middleware.js";
export type {
	AdminPreviewRequest,
	AdminPreviewContext,
} from "./src/admin-preview-middleware";

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
export {
	localeFromPath,
	localeFromAcceptLanguage,
} from "./src/sqlite-runtime/utils";

// Vite integration helpers
export {
	isAstropressLocalRuntimeModuleRequest,
	createAstropressLocalRuntimeModulePlugin,
	createAstropressViteAliases,
	createAstropressPackageResolverPlugin,
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
export {
	isSeededPostRecord,
	isSeededPageRecord,
	getSeededAdminContentType,
} from "./src/seeded-content-type";
export type {
	SeededContentRecordLike,
	SeededAdminContentType,
} from "./src/seeded-content-type";

// Media
export {
	resolveMediaUrl,
	resolveRuntimeMediaUrl,
	getRuntimeMediaResolutionOptions,
} from "./src/media";
export type { MediaRecord } from "./src/media";
export { guessMediaMimeType } from "./src/local-media-storage";
export { guessImageMimeType } from "./src/local-image-storage";
export {
	storeRuntimeMediaObject,
	deleteRuntimeMediaObject,
} from "./src/runtime-media-storage";

// Newsletter
export {
	newsletterAdapter,
	placeholderAdapter,
} from "./src/newsletter-adapter";
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
export {
	readLocalImageAsset,
	resolveLocalImageDiskPath,
} from "./src/local-image-storage";

// Deploy and content-services ops
export { createAstropressGitHubPagesDeployTarget } from "./src/deploy/github-pages.js";
export { createAstropressCloudflarePagesDeployTarget } from "./src/deploy/cloudflare-pages.js";
export { createAstropressVercelDeployTarget } from "./src/deploy/vercel.js";
export { createAstropressNetlifyDeployTarget } from "./src/deploy/netlify.js";
export { createAstropressRenderDeployTarget } from "./src/deploy/render.js";
export { createAstropressGitLabPagesDeployTarget } from "./src/deploy/gitlab-pages.js";
export { createAstropressCustomDeployTarget } from "./src/deploy/custom.js";
export {
	bootstrapAstropressContentServices,
	verifyAstropressContentServices,
} from "./src/content-services-ops.js";
export type {
	AstropressContentServicesBootstrapInput,
	AstropressContentServicesVerifyInput,
	AstropressContentServicesOperationReport,
} from "./src/content-services-ops";
export { runAstropressDbMigrationsForCli } from "./src/db-migrate-ops.js";
export type {
	AstropressDbMigrateInput,
	AstropressDbMigrateReport,
} from "./src/db-migrate-ops";

// Phase 3/4 admin-action runtime wrappers — admin endpoints route
// through these instead of calling the connect-flow primitives
// directly so they can pull the integrations repo from
// `loadLocalAdminStore()`.
export {
	connectIntegrationAction,
	reverifyIntegrationAction,
	disconnectIntegrationAction,
} from "./src/runtime-actions-integrations.js";
export type {
	ConnectIntegrationActionInput,
	RuntimeIntegrationActionResult,
} from "./src/runtime-actions-integrations";

// Phase 6 OAuth provider registry + state-token URL builder.
export {
	registerOAuthProvider,
	getOAuthProvider,
	listOAuthProviders,
	OAuthRegistryError,
} from "./src/integrations/oauth/registry.js";
export type { OAuthProviderDefinition } from "./src/integrations/oauth/registry";
export {
	buildAuthorizeRedirect,
	buildRedirectUri,
} from "./src/integrations/oauth/start.js";
export type {
	BuildAuthorizeRedirectArgs,
	BuildAuthorizeRedirectResult,
} from "./src/integrations/oauth/start";
export { exchangeCodeForToken } from "./src/integrations/oauth/token-exchange.js";
export type {
	OAuthTokenSet,
	OAuthTokenExchangeResult,
	OAuthTokenExchangeErrorCode,
	ExchangeCodeForTokenArgs,
} from "./src/integrations/oauth/token-exchange";

// Phase 6 inbound-webhook provider registry + receiver helper.
export {
	registerInboundWebhookProvider,
	getInboundWebhookProvider,
	listInboundWebhookProviders,
	InboundWebhookRegistryError,
} from "./src/integrations/webhooks/registry.js";
export type { InboundWebhookProviderDefinition } from "./src/integrations/webhooks/registry";
export { receiveInboundWebhook } from "./src/integrations/webhooks/receiver.js";
export type {
	InboundWebhookReceiveArgs,
	InboundWebhookReceiveResult,
} from "./src/integrations/webhooks/receiver";

// IntegrationStatusBadge tone/text mappers (component is in
// components/IntegrationStatusBadge.astro).
export {
	integrationStatusBadgeTone,
	integrationStatusBadgeText,
} from "./src/integrations/badge-tone.js";
export type {
	IntegrationStatusBadgeKind,
	IntegrationStatusBadgeTone,
	IntegrationStatusBadgeLabels,
} from "./src/integrations/badge-tone";
