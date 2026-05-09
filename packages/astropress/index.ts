// Package version
export const PROVIDER_CONTRACT_VERSION = "0.1";

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
export type {
	AstropressAppwriteAdapterOptions,
	AstropressAppwriteHostedAdapterOptions,
	AstropressAppwriteHostedConfig,
} from "./src/adapters/appwrite";
export {
	createAstropressAppwriteAdapter,
	createAstropressAppwriteHostedAdapter,
	readAstropressAppwriteHostedConfig,
} from "./src/adapters/appwrite.js";
export type { AstropressCloudflareAdapterOptions } from "./src/adapters/cloudflare";
export { createAstropressCloudflareAdapter } from "./src/adapters/cloudflare.js";
export type {
	AstropressHostedAdapterOptions,
	AstropressHostedProviderKind,
} from "./src/adapters/hosted";
export {
	createAstropressHostedAdapter,
	resolveAstropressHostedProvider,
} from "./src/adapters/hosted.js";
export type {
	AstropressNeonAdapterOptions,
	AstropressNeonHostedAdapterOptions,
	AstropressNeonHostedConfig,
} from "./src/adapters/neon";
export {
	createAstropressNeonAdapter,
	createAstropressNeonHostedAdapter,
	readAstropressNeonHostedConfig,
} from "./src/adapters/neon.js";
export type {
	AstropressNhostAdapterOptions,
	AstropressNhostHostedAdapterOptions,
	AstropressNhostHostedConfig,
} from "./src/adapters/nhost";
export {
	createAstropressNhostAdapter,
	createAstropressNhostHostedAdapter,
	readAstropressNhostHostedConfig,
} from "./src/adapters/nhost.js";
export type {
	AstropressPocketbaseAdapterOptions,
	AstropressPocketbaseHostedAdapterOptions,
	AstropressPocketbaseHostedConfig,
} from "./src/adapters/pocketbase";
export {
	createAstropressPocketbaseAdapter,
	createAstropressPocketbaseHostedAdapter,
	readAstropressPocketbaseHostedConfig,
} from "./src/adapters/pocketbase.js";
export type {
	AstropressSupabaseAdapterOptions,
	AstropressSupabaseHostedAdapterOptions,
	AstropressSupabaseHostedConfig,
} from "./src/adapters/supabase";
export {
	createAstropressSupabaseAdapter,
	createAstropressSupabaseHostedAdapter,
	readAstropressSupabaseHostedConfig,
} from "./src/adapters/supabase.js";
export type {
	AstropressTursoAdapterOptions,
	AstropressTursoHostedAdapterOptions,
	AstropressTursoHostedConfig,
} from "./src/adapters/turso";
export {
	createAstropressTursoAdapter,
	createAstropressTursoHostedAdapter,
	readAstropressTursoHostedConfig,
} from "./src/adapters/turso.js";
export type {
	DeployHookConfig,
	DeployHookType,
	PublishTriggerResult,
} from "./src/admin-action-publish";
// Publish action
export {
	resolveDeployHookFromEnv,
	triggerPublish,
} from "./src/admin-action-publish.js";
// Admin form utilities
export {
	actionErrorRedirect,
	actionRedirect,
	requireAdminFormAction,
	withAdminFormAction,
} from "./src/admin-action-utils";
export {
	ASTROPRESS_ADMIN_APP_NAME,
	ASTROPRESS_ADMIN_PRODUCT_NAME,
	buildAstropressAdminDocumentTitle,
} from "./src/admin-branding.js";
export type { AdminDashboardModel } from "./src/admin-dashboard";
// Admin page model builders
export { buildAdminDashboardModel } from "./src/admin-dashboard";
export type { AdminLocale } from "./src/admin-labels";
export {
	ADMIN_LOCALE_COOKIE,
	pickAdminLocaleFromAcceptLanguage,
	resolveAdminLocale,
} from "./src/admin-locale.js";
export type { AdminLocalePair } from "./src/admin-locale-links";
export { getAdminLocalePair } from "./src/admin-locale-links";
export type { PageLabelKey } from "./src/admin-page-labels";
export { getPageT, pageLabels } from "./src/admin-page-labels.js";
export type { AdminPageResult } from "./src/admin-page-models";
export {
	buildAcceptInvitePageModel,
	buildAdminDashboardPageModel,
	buildArchiveEditorModel,
	buildArchivesIndexPageModel,
	buildAuthorsPageModel,
	buildCommentsPageModel,
	buildMediaPageModel,
	buildPagesIndexPageModel,
	buildPostEditorPageModel,
	buildPostRevisionsPageModel,
	buildPostsIndexPageModel,
	buildRedirectsPageModel,
	buildResetPasswordPageModel,
	buildRoutePageEditorModel,
	buildRouteTablePageModel,
	buildSeoPageModel,
	buildSettingsPageModel,
	buildSystemPageModel,
	buildTaxonomiesPageModel,
	buildTestimonialsPageModel,
	buildTranslationsPageModel,
	buildUsersPageModel,
} from "./src/admin-page-models";
export type {
	AccessPageModel,
	AccessPageTab,
} from "./src/admin-page-models-access";
export { buildAccessPageModel } from "./src/admin-page-models-access.js";
export type {
	AdminPreviewContext,
	AdminPreviewRequest,
} from "./src/admin-preview-middleware";
// Preview middleware helpers
export {
	buildPreviewLoginRedirect,
	resolvePreviewPath,
} from "./src/admin-preview-middleware.js";
export type {
	AstropressAdminRouteDefinition,
	AstropressAdminRouteInjector,
	AstropressAdminRouteKind,
} from "./src/admin-routes";
export {
	ASTROPRESS_ADMIN_BASE_PATH,
	createAstropressAdminRouteInjectionPlan,
	injectAstropressAdminRoutes,
	listAstropressAdminRoutes,
	resolveAstropressAdminRouteEntrypoints,
} from "./src/admin-routes.js";
export {
	invalidateAstropressAdminSlugCache,
	resolveAstropressAdminSlug,
} from "./src/admin-slug-cache";
export type {
	AdminStubKey,
	AdminStubPageEntry,
	AdminStubPageSlug,
	StubEntry,
	StubProvider,
} from "./src/admin-stub-catalog";
export {
	ADMIN_STUB_PAGES,
	adminStubs,
	getAdminStubPage,
} from "./src/admin-stub-catalog.js";
export type {
	AstropressAdminNavKey,
	AstropressResolvedAdminUiConfig,
} from "./src/admin-ui";
export {
	getAdminLabel,
	resolveAstropressAdminUiConfig,
} from "./src/admin-ui.js";
export type {
	AstropressAppHost,
	AstropressAppHostTarget,
} from "./src/app-host-targets";
export {
	getAstropressAppHostTarget,
	listAstropressAppHosts,
} from "./src/app-host-targets";
export type {
	AstropressBuildTimeLoaderOptions,
	AstropressContentLoader,
} from "./src/build-time-content-loader";
// Build-time content loading
export { createAstropressBuildTimeLoader } from "./src/build-time-content-loader.js";
export type {
	AstropressContentEvent,
	AstropressMediaEvent,
	AstropressPlugin,
	CmsConfig,
	ContentTypeDefinition,
	FieldDefinition,
	TestimonialsConfig,
} from "./src/config";
// Core configuration seam
export {
	dispatchPluginContentEvent,
	dispatchPluginMediaEvent,
	getCmsConfig,
	registerCms,
	validateContentFields,
} from "./src/config";
export type {
	AstropressContentServicesBootstrapInput,
	AstropressContentServicesOperationReport,
	AstropressContentServicesVerifyInput,
} from "./src/content-services-ops";
export {
	bootstrapAstropressContentServices,
	verifyAstropressContentServices,
} from "./src/content-services-ops.js";
// Crypto
export { hashPassword, verifyPassword } from "./src/crypto-utils";
export type {
	D1AdminMutationStore,
	D1AdminReadStore,
} from "./src/d1-admin-store";
export {
	createD1AdminMutationStore,
	createD1AdminReadStore,
} from "./src/d1-admin-store";
// D1 types
export type {
	D1DatabaseLike,
	D1PreparedStatement,
	D1Result,
} from "./src/d1-database";
export type {
	AstropressDataServices,
	AstropressDataServiceTarget,
} from "./src/data-service-targets";
export {
	getAstropressDataServiceTarget,
	listAstropressDataServiceTargets,
} from "./src/data-service-targets";
export type {
	AstropressDbMigrateInput,
	AstropressDbMigrateReport,
} from "./src/db-migrate-ops";
export { runAstropressDbMigrationsForCli } from "./src/db-migrate-ops.js";
export { createAstropressCloudflarePagesDeployTarget } from "./src/deploy/cloudflare-pages.js";
export { createAstropressCustomDeployTarget } from "./src/deploy/custom.js";
// Deploy and content-services ops
export { createAstropressGitHubPagesDeployTarget } from "./src/deploy/github-pages.js";
export { createAstropressGitLabPagesDeployTarget } from "./src/deploy/gitlab-pages.js";
export { createAstropressNetlifyDeployTarget } from "./src/deploy/netlify.js";
export { createAstropressRenderDeployTarget } from "./src/deploy/render.js";
export { createAstropressVercelDeployTarget } from "./src/deploy/vercel.js";
export type {
	AstropressDeploymentMatrixEntry,
	AstropressDeploymentProfile,
	AstropressDeploymentSupportLevel,
} from "./src/deployment-matrix";
export {
	getAstropressDeploymentMatrixEntry,
	listAstropressDeploymentMatrixEntries,
	resolveAstropressDeploymentSupportLevel,
} from "./src/deployment-matrix";
export type { AstropressHostRuntimeModules } from "./src/host-runtime-modules";
export { defineAstropressHostRuntimeModules } from "./src/host-runtime-modules";
export type { AstropressHostedApiAdapterOptions } from "./src/hosted-api-adapter";
export { createAstropressHostedApiAdapter } from "./src/hosted-api-adapter.js";
export type { AstropressHostedPlatformAdapterOptions } from "./src/hosted-platform-adapter";
export { createAstropressHostedPlatformAdapter } from "./src/hosted-platform-adapter.js";
export { optimizeImageLoading } from "./src/html-optimization";
// Content utilities
export { sanitizeHtml } from "./src/html-sanitization";
export type { AstropressInMemoryPlatformAdapterOptions } from "./src/in-memory-platform-adapter";
export { createAstropressInMemoryPlatformAdapter } from "./src/in-memory-platform-adapter.js";
export type {
	IntegrationStatusBadgeKind,
	IntegrationStatusBadgeLabels,
	IntegrationStatusBadgeTone,
} from "./src/integrations/badge-tone";
// IntegrationStatusBadge tone/text mappers (component is in
// components/IntegrationStatusBadge.astro).
export {
	integrationStatusBadgeText,
	integrationStatusBadgeTone,
} from "./src/integrations/badge-tone.js";
export type {
	ConnectIntegrationParams,
	ConnectIntegrationResult,
} from "./src/integrations/connect-flow";
export {
	connectIntegration,
	reverifyIntegration,
	runProviderVerify,
} from "./src/integrations/connect-flow.js";
export {
	registerAbTesting,
	registerAnalytics,
	registerCdnPurge,
	registerDeployHooks,
	registerForms,
	registerMonitoring,
	registerNewsletter,
	registerSearch,
} from "./src/integrations/domains.js";
export type { OAuthProviderDefinition } from "./src/integrations/oauth/registry";
// Phase 6 OAuth provider registry + state-token URL builder.
export {
	getOAuthProvider,
	listOAuthProviders,
	OAuthRegistryError,
	registerOAuthProvider,
} from "./src/integrations/oauth/registry.js";
export type {
	BuildAuthorizeRedirectArgs,
	BuildAuthorizeRedirectResult,
} from "./src/integrations/oauth/start";
export {
	buildAuthorizeRedirect,
	buildRedirectUri,
} from "./src/integrations/oauth/start.js";
export type {
	IssuedOAuthState,
	IssueOAuthStateArgs,
	OAuthStateContext,
	VerifyOAuthStateArgs,
	VerifyOAuthStateErrorCode,
	VerifyOAuthStateResult,
} from "./src/integrations/oauth/state";
// Phase 6 OAuth state-token primitives (state issued at the start of
// authorization-code flows is HMAC-signed and self-describing).
export {
	DEFAULT_OAUTH_STATE_TTL_MS,
	issueOAuthState,
	verifyOAuthState,
} from "./src/integrations/oauth/state.js";
export type {
	ExchangeCodeForTokenArgs,
	OAuthTokenExchangeErrorCode,
	OAuthTokenExchangeResult,
	OAuthTokenSet,
} from "./src/integrations/oauth/token-exchange";
export { exchangeCodeForToken } from "./src/integrations/oauth/token-exchange.js";
export type { CloudflareCdnFields } from "./src/integrations/providers/cloudflare-cdn";
export {
	CLOUDFLARE_CDN_FIELDS,
	CloudflareCdnVerifyError,
	classifyCloudflareStatus,
	registerCloudflareCdn,
	verifyCloudflareCdn,
} from "./src/integrations/providers/cloudflare-cdn.js";
export type { GithubDeployFields } from "./src/integrations/providers/github-deploy";
export {
	classifyGithubStatus,
	GITHUB_DEPLOY_FIELDS,
	GithubDeployVerifyError,
	registerGithubDeploy,
	verifyGithubDeploy,
} from "./src/integrations/providers/github-deploy.js";
export type { ListmonkFields } from "./src/integrations/providers/listmonk";
// Phase 4 push-button providers — hosts call these once at boot to
// register the corresponding registry entry. Each provider exports
// its Zod schema and verify() helper so admin pages can drive a
// connect form against the same shape the registry validates.
export {
	LISTMONK_FIELDS,
	ListmonkVerifyError,
	registerListmonk,
	verifyListmonk,
} from "./src/integrations/providers/listmonk.js";
export type { PlausibleFields } from "./src/integrations/providers/plausible";
export {
	PLAUSIBLE_FIELDS,
	PlausibleVerifyError,
	registerPlausible,
	verifyPlausible,
} from "./src/integrations/providers/plausible.js";
export type {
	IntegrationDomain,
	ProviderDefinition,
	RegisteredProvider,
} from "./src/integrations/registry";
// Per-domain integration registry (Phase 3) — hosts call
// `registerNewsletter()` / `registerAnalytics()` / etc. from setup
// code; admin actions and runtime adapters look providers up by
// (domain, providerId).
export {
	getProvider,
	INTEGRATION_DOMAINS,
	IntegrationRegistryError,
	listProviders,
	registerProvider,
} from "./src/integrations/registry.js";
export type { ConnectedProvider } from "./src/integrations/runtime";
export {
	createRequestProviderCache,
	getConnectedProvider,
	listRegisteredProvidersForDomain,
} from "./src/integrations/runtime.js";
export type {
	InboundWebhookAlgorithm,
	VerifyInboundWebhookArgs,
} from "./src/integrations/webhooks/inbound";
// Phase 6 inbound-webhook signature verifier (HMAC over raw request
// bytes; GitHub-style algorithm-prefixed headers supported).
export {
	verifyGithubWebhookSignature,
	verifyInboundWebhookSignature,
} from "./src/integrations/webhooks/inbound.js";
export type {
	InboundWebhookReceiveArgs,
	InboundWebhookReceiveResult,
} from "./src/integrations/webhooks/receiver";
export { receiveInboundWebhook } from "./src/integrations/webhooks/receiver.js";
export type { InboundWebhookProviderDefinition } from "./src/integrations/webhooks/registry";
// Phase 6 inbound-webhook provider registry + receiver helper.
export {
	getInboundWebhookProvider,
	InboundWebhookRegistryError,
	listInboundWebhookProviders,
	registerInboundWebhookProvider,
} from "./src/integrations/webhooks/registry.js";
// Local image storage (dev only)
export {
	guessImageMimeType,
	readLocalImageAsset,
	resolveLocalImageDiskPath,
} from "./src/local-image-storage";
export { guessMediaMimeType } from "./src/local-media-storage";
export type {
	LocalAdminAuthModule,
	LocalAdminStoreModule,
	LocalCmsRegistryModule,
	LocalImageStorageModule,
	LocalMediaStorageModule,
} from "./src/local-runtime-modules";
// Locale / i18n utilities
export {
	canonicalUrlForRoute,
	getAlternateLinksForEnglishRoute,
	getLocaleSwitchTargets,
	sanitizeCanonicalUrl,
} from "./src/locale-links";
export type { MediaRecord } from "./src/media";
// Media
export {
	getRuntimeMediaResolutionOptions,
	resolveMediaUrl,
	resolveRuntimeMediaUrl,
} from "./src/media";
export type { NewsletterAdapter } from "./src/newsletter-adapter";
// Newsletter
export {
	newsletterAdapter,
	placeholderAdapter,
} from "./src/newsletter-adapter";
// Persistence types
export type {
	Actor,
	AdminRole,
	AdminStoreAdapter,
	AuditEvent,
	AuditRepository,
	AuthorRecord,
	AuthorRepository,
	AuthRepository,
	CommentPolicy,
	CommentRecord,
	CommentRepository,
	CommentStatus,
	ContactSubmission,
	ContentOverride,
	ContentRecord,
	ContentRepository,
	ContentRevision,
	ContentStatus,
	InviteRequest,
	ManagedAdminUser,
	MediaAsset,
	MediaRepository,
	PasswordResetRequest,
	RateLimitRepository,
	RedirectRepository,
	RedirectRule,
	SessionUser,
	SettingsRepository,
	SubmissionRepository,
	TaxonomyKind,
	TaxonomyRepository,
	TaxonomyTerm,
	TestimonialSource,
	TestimonialStatus,
	TestimonialSubmission,
	TestimonialSubmissionInput,
	TranslationRepository,
	UserRepository,
} from "./src/persistence-types";
export type {
	AstropressCmsConfig,
	AstropressHostPanelCapability,
	AstropressPlatformAdapter,
	AstropressWordPressImportArtifacts,
	AstropressWordPressImportEntityCount,
	AstropressWordPressImportInventory,
	AstropressWordPressImportLocalApplyReport,
	AstropressWordPressImportPlan,
	AstropressWordPressImportReport,
	AuthStore,
	AuthUser,
	ContentListOptions,
	ContentStore,
	ContentStoreRecord,
	DeployTarget,
	GitSyncAdapter,
	ImportSource,
	MediaAssetRecord,
	MediaStore,
	PreviewSession,
	ProviderCapabilities,
	ProviderKind,
	ReadableContentKind,
	RevisionRecord,
	RevisionStore,
	SaveableContentKind,
} from "./src/platform-contracts";
// Platform contracts
export {
	assertProviderContract,
	isAuthUserAdmin,
	normalizeProviderCapabilities,
} from "./src/platform-contracts";
export type {
	AstropressAppHostEnv,
	AstropressContentServicesEnv,
	AstropressDataServicesEnv,
	AstropressDeployTargetEnv,
	AstropressHostedProviderEnv,
	AstropressLocalProviderEnv,
	AstropressProjectEnvContract,
} from "./src/project-env";
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
	AstropressProjectScaffold,
	AstropressProjectScaffoldInput,
	AstropressScaffoldProvider,
} from "./src/project-scaffold";
export { createAstropressProjectScaffold } from "./src/project-scaffold.js";
export type {
	AstropressExistingPlatform,
	AstropressProviderChoiceInput,
	AstropressProviderChoiceRecommendation,
	AstropressProviderOpsComfort,
} from "./src/provider-choice";
export { recommendAstropressProvider } from "./src/provider-choice.js";
export type { FirstPartyProviderTarget } from "./src/provider-targets";
export {
	getFirstPartyProviderTarget,
	listFirstPartyProviderTargets,
} from "./src/provider-targets";
export type { AstropressPublicSiteOptions } from "./src/public-site-integration";
// Integration helpers
export { createAstropressPublicSiteIntegration } from "./src/public-site-integration.js";
// Path utilities
export { appendQueryParam, resolveSafeReturnPath } from "./src/return-path";
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
export type {
	ConnectIntegrationActionInput,
	RuntimeIntegrationActionResult,
} from "./src/runtime-actions-integrations";
// Phase 3/4 admin-action runtime wrappers — admin endpoints route
// through these instead of calling the connect-flow primitives
// directly so they can pull the integrations repo from
// `loadLocalAdminStore()`.
export {
	connectIntegrationAction,
	disconnectIntegrationAction,
	reverifyIntegrationAction,
} from "./src/runtime-actions-integrations.js";
// Admin actions (write)
export {
	consumeRuntimeInviteToken,
	consumeRuntimePasswordResetToken,
	createRuntimeAuthor,
	createRuntimeCategory,
	createRuntimeContentRecord,
	createRuntimeMediaAsset,
	createRuntimePasswordResetToken,
	createRuntimeRedirectRule,
	createRuntimeTag,
	deleteRuntimeAuthor,
	deleteRuntimeCategory,
	deleteRuntimeMediaAsset,
	deleteRuntimeRedirectRule,
	deleteRuntimeTag,
	getRuntimeInviteRequest,
	getRuntimePasswordResetRequest,
	inviteRuntimeAdminUser,
	moderateRuntimeComment,
	restoreRuntimeRevision,
	saveRuntimeContentState,
	saveRuntimeSettings,
	suspendRuntimeAdminUser,
	unsuspendRuntimeAdminUser,
	updateRuntimeAuthor,
	updateRuntimeCategory,
	updateRuntimeMediaAsset,
	updateRuntimeTag,
	updateRuntimeTranslationState,
} from "./src/runtime-admin-actions";
// Admin auth
export {
	authenticateRuntimeAdminUser,
	createRuntimeSession,
	getRuntimeCsrfToken,
	getRuntimeSessionUser,
	recordRuntimeLogout,
	recordRuntimeSuccessfulLogin,
	revokeRuntimeSession,
} from "./src/runtime-admin-auth";
export type {
	R2BucketLike,
	R2ObjectBodyLike,
	RuntimeBindings,
} from "./src/runtime-env";
// Runtime environment
export {
	getAdminBootstrapConfig,
	getAstropressRootSecret,
	getAstropressRootSecretCandidates,
	getCloudflareBindings,
	getLoginSecurityConfig,
	getNewsletterConfig,
	getRuntimeEnv,
	getStringRuntimeValue,
	getTransactionalEmailConfig,
	getTurnstileSiteKey,
	isProductionRuntime,
} from "./src/runtime-env";
export {
	deleteRuntimeMediaObject,
	storeRuntimeMediaObject,
} from "./src/runtime-media-storage";
export { moderateRuntimeTestimonial } from "./src/runtime-mutation-store";
// Page store (read + rate limits)
export {
	checkRuntimeRateLimit,
	getRuntimeAdminUsers,
	getRuntimeAuditEvents,
	getRuntimeAuthors,
	getRuntimeCategories,
	getRuntimeComments,
	getRuntimeContactSubmissions,
	getRuntimeContentRevisions,
	getRuntimeContentState,
	getRuntimeContentStateByPath,
	getRuntimeMediaAssets,
	getRuntimeRedirectRules,
	getRuntimeSettings,
	getRuntimeTags,
	getRuntimeTranslationState,
	listRuntimeContentStates,
	peekRuntimeRateLimit,
	recordRuntimeFailedAttempt,
	searchRuntimeContentStates,
	submitRuntimeContact,
	submitRuntimePublicComment,
} from "./src/runtime-page-store";
// Route registry
export {
	createRuntimeStructuredPageRoute,
	getRuntimeArchiveRoute,
	getRuntimeStructuredPageRoute,
	getRuntimeSystemRoute,
	listRuntimeStructuredPageRoutes,
	listRuntimeSystemRoutes,
	saveRuntimeArchiveRoute,
	saveRuntimeStructuredPageRoute,
	saveRuntimeSystemRoute,
} from "./src/runtime-route-registry";
export type {
	AstropressSecurityArea,
	AstropressSecurityHeadersOptions,
} from "./src/security-headers";
export {
	applyAstropressSecurityHeaders,
	createAstropressSecureRedirect,
	createAstropressSecurityHeaders,
	isTrustedRequestOrigin,
	isTrustedStrictRequestOrigin,
} from "./src/security-headers.js";
export type { AstropressSecurityMiddlewareOptions } from "./src/security-middleware";
export {
	createAstropressSecurityMiddleware,
	resolveAstropressSecurityArea,
} from "./src/security-middleware.js";
export type {
	SeededAdminContentType,
	SeededContentRecordLike,
} from "./src/seeded-content-type";
export {
	getSeededAdminContentType,
	isSeededPageRecord,
	isSeededPostRecord,
} from "./src/seeded-content-type";
export type { SiteSettings } from "./src/site-settings";
// Site settings
export { defaultSiteSettings } from "./src/site-settings";
export type {
	ConnectIntegrationInput,
	IntegrationStatusRow,
	IntegrationStatusValue,
	IntegrationsRepository,
} from "./src/sqlite-runtime/integrations";
// Phase 2 secret-store repository (status surface + sealed-secret
// surface). Hosts that need to read connected_integrations from
// outside the bundled admin actions construct the repo directly.
export { createIntegrationsRepository } from "./src/sqlite-runtime/integrations.js";
export {
	localeFromAcceptLanguage,
	localeFromPath,
} from "./src/sqlite-runtime/utils";
// Email
export {
	sendContactNotification,
	sendPasswordResetEmail,
	sendTransactionalEmail,
	sendUserInviteEmail,
} from "./src/transactional-email";
export type { TranslationState } from "./src/translation-state";
// Translation
export {
	isPublishedTranslationState,
	normalizeTranslationState,
	translationStates,
} from "./src/translation-state";
// Turnstile
export { isTurnstileEnabled, verifyTurnstileToken } from "./src/turnstile";
export type {
	AstropressViteAlias,
	AstropressVitePlugin,
	AstropressViteRuntimeAliasOptions,
} from "./src/vite-runtime-alias";
// Vite integration helpers
export {
	createAstropressLocalRuntimeModulePlugin,
	createAstropressPackageResolverPlugin,
	createAstropressViteAliases,
	isAstropressLocalRuntimeModuleRequest,
} from "./src/vite-runtime-alias";
export type { AstropressVitestPlugin } from "./src/vitest-runtime-alias";
export { createAstropressVitestLocalRuntimePlugins } from "./src/vitest-runtime-alias";
