# Astropress API Reference

Auto-generated from TypeScript source via the TypeScript compiler API.
Run `bun run docs:api` to regenerate.

Generated: 2026-04-16

---

## `astropress`

### Functions

#### `createAstropressPublicSiteIntegration`
```ts
function createAstropressPublicSiteIntegration(options: AstropressPublicSiteOptions): AstroIntegration
```

#### `registerCms`
```ts
function registerCms(config: CmsConfig): void
```

#### `getCmsConfig`
```ts
function getCmsConfig(): CmsConfig
```

#### `dispatchPluginContentEvent`
```ts
function dispatchPluginContentEvent(hook: "onContentSave" | "onContentPublish", event: AstropressContentEvent): Promise<void>
```

#### `dispatchPluginMediaEvent`
```ts
function dispatchPluginMediaEvent(event: AstropressMediaEvent): Promise<void>
```

#### `validateContentFields`
```ts
function validateContentFields(contentType: ContentTypeDefinition, metadata: Record<string, unknown>): string | null
```

#### `buildAstropressAdminDocumentTitle`
```ts
function buildAstropressAdminDocumentTitle(title: string): string
```

#### `resolveAstropressAdminUiConfig`
```ts
function resolveAstropressAdminUiConfig(): AstropressResolvedAdminUiConfig
```

#### `invalidateAstropressAdminSlugCache`
```ts
function invalidateAstropressAdminSlugCache(): void
```

#### `resolveAstropressAdminSlug`
```ts
function resolveAstropressAdminSlug(locals: Locals): Promise<string>
```

#### `createAstropressAdminRouteInjectionPlan`
```ts
function createAstropressAdminRouteInjectionPlan(pagesDirectory: string): { entrypoint: string; pattern: string; kind: AstropressAdminRouteKind; }[]
```

#### `injectAstropressAdminRoutes`
```ts
function injectAstropressAdminRoutes(pagesDirectory: string, injectRoute: AstropressAdminRouteInjector): { entrypoint: string; pattern: string; kind: AstropressAdminRouteKind; }[]
```

#### `listAstropressAdminRoutes`
```ts
function listAstropressAdminRoutes(): AstropressAdminRouteDefinition[]
```

#### `resolveAstropressAdminRouteEntrypoints`
```ts
function resolveAstropressAdminRouteEntrypoints(basePath: string): { entrypoint: string; pattern: string; kind: AstropressAdminRouteKind; }[]
```

#### `createAstropressBuildTimeLoader`
```ts
function createAstropressBuildTimeLoader(provider: AstropressPlatformAdapter, options: AstropressBuildTimeLoaderOptions): { posts(): AstropressContentLoader; pages(): AstropressContentLoader; }
```

#### `normalizeProviderCapabilities`
```ts
function normalizeProviderCapabilities(partial: Pick<ProviderCapabilities, "name"> & Partial<Omit<ProviderCapabilities, "name">>): ProviderCapabilities
```

#### `assertProviderContract`
```ts
function assertProviderContract(adapter: AstropressPlatformAdapter): AstropressPlatformAdapter
```

#### `listFirstPartyProviderTargets`
```ts
function listFirstPartyProviderTargets(): FirstPartyProviderTarget[]
```

#### `getFirstPartyProviderTarget`
```ts
function getFirstPartyProviderTarget(provider: ProviderKind): FirstPartyProviderTarget
```

#### `listAstropressAppHosts`
```ts
function listAstropressAppHosts(): AstropressAppHostTarget[]
```

#### `getAstropressAppHostTarget`
```ts
function getAstropressAppHostTarget(appHost: AstropressAppHost): AstropressAppHostTarget
```

#### `listAstropressDataServiceTargets`
```ts
function listAstropressDataServiceTargets(): AstropressDataServiceTarget[]
```

#### `getAstropressDataServiceTarget`
```ts
function getAstropressDataServiceTarget(dataServices: AstropressDataServices): AstropressDataServiceTarget
```

#### `listAstropressDeploymentMatrixEntries`
```ts
function listAstropressDeploymentMatrixEntries(): AstropressDeploymentMatrixEntry[]
```

#### `getAstropressDeploymentMatrixEntry`
```ts
function getAstropressDeploymentMatrixEntry(profile: AstropressDeploymentProfile): AstropressDeploymentMatrixEntry | null
```

#### `resolveAstropressDeploymentSupportLevel`
```ts
function resolveAstropressDeploymentSupportLevel(profile: AstropressDeploymentProfile): AstropressDeploymentSupportLevel
```

#### `createAstropressInMemoryPlatformAdapter`
```ts
function createAstropressInMemoryPlatformAdapter(options: AstropressInMemoryPlatformAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressProjectScaffold`
```ts
function createAstropressProjectScaffold(input: AstropressProjectScaffoldInput | AstropressScaffoldProvider): AstropressProjectScaffold
```

#### `recommendAstropressProvider`
```ts
function recommendAstropressProvider(input: AstropressProviderChoiceInput): AstropressProviderChoiceRecommendation
```

#### `resolveAstropressAppHostFromEnv`
```ts
function resolveAstropressAppHostFromEnv(env: Record<string, string | undefined>): AstropressAppHost
```

#### `resolveAstropressDataServicesFromEnv`
```ts
function resolveAstropressDataServicesFromEnv(env: Record<string, string | undefined>): AstropressDataServices
```

#### `resolveAstropressDeployTarget`
```ts
function resolveAstropressDeployTarget(env: Record<string, string | undefined>): AstropressDeployTargetEnv
```

#### `resolveAstropressHostedProviderFromEnv`
```ts
function resolveAstropressHostedProviderFromEnv(env: Record<string, string | undefined>): AstropressHostedProviderEnv
```

#### `resolveAstropressLocalProviderFromEnv`
```ts
function resolveAstropressLocalProviderFromEnv(env: Record<string, string | undefined>): AstropressLocalProviderEnv
```

#### `resolveAstropressProjectEnvContract`
```ts
function resolveAstropressProjectEnvContract(env: Record<string, string | undefined>): AstropressProjectEnvContract
```

#### `resolveAstropressServiceOriginFromEnv`
```ts
function resolveAstropressServiceOriginFromEnv(env: Record<string, string | undefined>): string | null
```

#### `createAstropressHostedPlatformAdapter`
```ts
function createAstropressHostedPlatformAdapter(options: AstropressHostedPlatformAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressHostedApiAdapter`
```ts
function createAstropressHostedApiAdapter(options: AstropressHostedApiAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressCloudflareAdapter`
```ts
function createAstropressCloudflareAdapter(options: AstropressCloudflareAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressHostedAdapter`
```ts
function createAstropressHostedAdapter(options: AstropressHostedAdapterOptions): AstropressPlatformAdapter
```

#### `resolveAstropressHostedProvider`
```ts
function resolveAstropressHostedProvider(provider: string | null | undefined): AstropressHostedProviderKind
```

#### `createAstropressSupabaseAdapter`
```ts
function createAstropressSupabaseAdapter(options: AstropressSupabaseAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressSupabaseHostedAdapter`
```ts
function createAstropressSupabaseHostedAdapter(options: AstropressSupabaseHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressSupabaseHostedConfig`
```ts
function readAstropressSupabaseHostedConfig(env: Record<string, string | undefined>): AstropressSupabaseHostedConfig
```

#### `createAstropressAppwriteAdapter`
```ts
function createAstropressAppwriteAdapter(options: AstropressAppwriteAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressAppwriteHostedAdapter`
```ts
function createAstropressAppwriteHostedAdapter(options: AstropressAppwriteHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressAppwriteHostedConfig`
```ts
function readAstropressAppwriteHostedConfig(env: Record<string, string | undefined>): AstropressAppwriteHostedConfig
```

#### `createAstropressPocketbaseAdapter`
```ts
function createAstropressPocketbaseAdapter(options: AstropressPocketbaseAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressPocketbaseHostedAdapter`
```ts
function createAstropressPocketbaseHostedAdapter(options: AstropressPocketbaseHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressPocketbaseHostedConfig`
```ts
function readAstropressPocketbaseHostedConfig(env: Record<string, string | undefined>): AstropressPocketbaseHostedConfig
```

#### `createAstropressTursoAdapter`
```ts
function createAstropressTursoAdapter(options: AstropressTursoAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressTursoHostedAdapter`
```ts
function createAstropressTursoHostedAdapter(options: AstropressTursoHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressTursoHostedConfig`
```ts
function readAstropressTursoHostedConfig(env: Record<string, string | undefined>): AstropressTursoHostedConfig
```

#### `createAstropressNeonAdapter`
```ts
function createAstropressNeonAdapter(options: AstropressNeonAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressNeonHostedAdapter`
```ts
function createAstropressNeonHostedAdapter(options: AstropressNeonHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressNeonHostedConfig`
```ts
function readAstropressNeonHostedConfig(env: Record<string, string | undefined>): AstropressNeonHostedConfig
```

#### `createAstropressNhostAdapter`
```ts
function createAstropressNhostAdapter(options: AstropressNhostAdapterOptions): AstropressPlatformAdapter
```

#### `createAstropressNhostHostedAdapter`
```ts
function createAstropressNhostHostedAdapter(options: AstropressNhostHostedAdapterOptions): AstropressPlatformAdapter
```

#### `readAstropressNhostHostedConfig`
```ts
function readAstropressNhostHostedConfig(env: Record<string, string | undefined>): AstropressNhostHostedConfig
```

#### `normalizeTranslationState`
```ts
function normalizeTranslationState(value: string | null | undefined, fallback: "not_started" | "partial" | "fallback_en" | "translated" | "reviewed" | "published"): "not_started" | "partial" | "fallback_en" | "translated" | "reviewed" | "published"
```

#### `isPublishedTranslationState`
```ts
function isPublishedTranslationState(value: string | null | undefined): boolean
```

#### `createD1AdminReadStore`
```ts
function createD1AdminReadStore(db: D1DatabaseLike): D1AdminReadStore
```

#### `createD1AdminMutationStore`
```ts
function createD1AdminMutationStore(db: D1DatabaseLike): D1AdminMutationStore
```

#### `getRuntimeEnv`
```ts
function getRuntimeEnv(name: string): string | undefined
```

#### `isProductionRuntime`
```ts
function isProductionRuntime(): boolean
```

#### `getCloudflareBindings`
```ts
function getCloudflareBindings(locals: Locals | null | undefined): RuntimeBindings
```

#### `getStringRuntimeValue`
```ts
function getStringRuntimeValue(name: StringRuntimeKey, locals: Locals | null | undefined): string | undefined
```

#### `getNewsletterConfig`
```ts
function getNewsletterConfig(locals: Locals | null | undefined): { mode: string; listmonkApiUrl: string | undefined; listmonkApiUsername: string | undefined; listmonkApiPassword: string | undefined; listmonkListId: string | undefined; }
```

#### `getTransactionalEmailConfig`
```ts
function getTransactionalEmailConfig(locals: Locals | null | undefined): { mode: string; resendApiKey: string | undefined; resendFrom: string | undefined; smtpHost: string | undefined; smtpPort: string | undefined; smtpUsername: string | undefined; smtpPassword: string | undefined; smtpFrom: string | undefined; contactDestination: string | undefined; }
```

#### `getAdminBootstrapConfig`
```ts
function getAdminBootstrapConfig(locals: Locals | null | undefined): { adminPassword: string | undefined; editorPassword: string | undefined; bootstrapDisabled: boolean; adminDbPath: string | undefined; rootSecret: string; rootSecretPrevious: string; sessionSecret: string | undefined; sessionSecretPrevious: string | undefined; }
```

#### `getLoginSecurityConfig`
```ts
function getLoginSecurityConfig(locals: Locals | null | undefined): { maxLoginAttempts: number; secureCookies: boolean; turnstileSiteKey: string | undefined; turnstileSecretKey: string | undefined; }
```

#### `getTurnstileSiteKey`
```ts
function getTurnstileSiteKey(locals: Locals | null | undefined): string | undefined
```

#### `applyAstropressSecurityHeaders`
```ts
function applyAstropressSecurityHeaders(target: Headers, options: AstropressSecurityHeadersOptions): Headers
```

#### `createAstropressSecureRedirect`
```ts
function createAstropressSecureRedirect(location: string, status: number, options: AstropressSecurityHeadersOptions): Response
```

#### `createAstropressSecurityHeaders`
```ts
function createAstropressSecurityHeaders(options: AstropressSecurityHeadersOptions): Headers
```

#### `isTrustedRequestOrigin`
```ts
function isTrustedRequestOrigin(request: Request): boolean
```

#### `createAstropressSecurityMiddleware`
```ts
function createAstropressSecurityMiddleware(options: AstropressSecurityMiddlewareOptions): ({ url }: { url: URL; }, next: () => Promise<Response>) => Promise<Response>
```

#### `resolveAstropressSecurityArea`
```ts
function resolveAstropressSecurityArea(url: URL, adminBasePath: string): AstropressSecurityArea
```

#### `getRuntimeSettings`
```ts
function getRuntimeSettings(locals: Locals | null | undefined): Promise<SiteSettings>
```

#### `getRuntimeContentStateByPath`
```ts
function getRuntimeContentStateByPath(pathname: string, locals: Locals | null | undefined): Promise<ContentRecord | null>
```

#### `getRuntimeRedirectRules`
```ts
function getRuntimeRedirectRules(locals: Locals | null | undefined): Promise<RedirectRule[]>
```

#### `listRuntimeContentStates`
```ts
function listRuntimeContentStates(locals: Locals | null | undefined): Promise<ContentRecord[]>
```

#### `searchRuntimeContentStates`
```ts
function searchRuntimeContentStates(query: string, locals: Locals | null | undefined): Promise<ContentRecord[]>
```

#### `getRuntimeAuthors`
```ts
function getRuntimeAuthors(locals: Locals | null | undefined): Promise<AuthorRecord[]>
```

#### `getRuntimeCategories`
```ts
function getRuntimeCategories(locals: Locals | null | undefined): Promise<TaxonomyTerm[]>
```

#### `getRuntimeTags`
```ts
function getRuntimeTags(locals: Locals | null | undefined): Promise<TaxonomyTerm[]>
```

#### `getRuntimeComments`
```ts
function getRuntimeComments(locals: Locals | null | undefined): Promise<CommentRecord[]>
```

#### `getRuntimeAuditEvents`
```ts
function getRuntimeAuditEvents(locals: Locals | null | undefined): Promise<AuditEvent[]>
```

#### `getRuntimeAdminUsers`
```ts
function getRuntimeAdminUsers(locals: Locals | null | undefined): Promise<ManagedAdminUser[]>
```

#### `getRuntimeMediaAssets`
```ts
function getRuntimeMediaAssets(locals: Locals | null | undefined): Promise<MediaAsset[]>
```

#### `getRuntimeContentState`
```ts
function getRuntimeContentState(slug: string, locals: Locals | null | undefined): Promise<ContentRecord | null>
```

#### `getRuntimeContentRevisions`
```ts
function getRuntimeContentRevisions(slug: string, locals: Locals | null | undefined): Promise<ContentRevision[] | null>
```

#### `getRuntimeTranslationState`
```ts
function getRuntimeTranslationState(route: string, fallback: string, locals: Locals | null | undefined): Promise<string>
```

#### `getRuntimeContactSubmissions`
```ts
function getRuntimeContactSubmissions(locals: Locals | null | undefined): Promise<ContactSubmission[]>
```

#### `checkRuntimeRateLimit`
```ts
function checkRuntimeRateLimit(key: string, max: number, windowMs: number, locals: Locals | null | undefined): Promise<boolean>
```

#### `peekRuntimeRateLimit`
```ts
function peekRuntimeRateLimit(key: string, max: number, windowMs: number, locals: Locals | null | undefined): Promise<boolean>
```

#### `recordRuntimeFailedAttempt`
```ts
function recordRuntimeFailedAttempt(key: string, max: number, windowMs: number, locals: Locals | null | undefined): Promise<void>
```

#### `submitRuntimeContact`
```ts
function submitRuntimeContact(input: { name: string; email: string; message: string; submittedAt: string; }, locals: Locals | null | undefined): Promise<{ ok: true; submission: ContactSubmission; }>
```

#### `submitRuntimePublicComment`
```ts
function submitRuntimePublicComment(input: { author: string; email: string; body: string; route: string; submittedAt: string; }, locals: Locals | null | undefined): Promise<{ ok: true; comment: CommentRecord; } | { ok: false; error: string; }>
```

#### `getRuntimeStructuredPageRoute`
```ts
function getRuntimeStructuredPageRoute(pathname: string, locals: Locals | null | undefined): Promise<RuntimeStructuredPageRouteRecord | null>
```

#### `getRuntimeArchiveRoute`
```ts
function getRuntimeArchiveRoute(pathname: string, locals: Locals | null | undefined): Promise<RuntimeArchiveRouteRecord | null>
```

#### `getRuntimeSystemRoute`
```ts
function getRuntimeSystemRoute(pathname: string, locals: Locals | null | undefined): Promise<RuntimeSystemRouteRecord | null>
```

#### `listRuntimeStructuredPageRoutes`
```ts
function listRuntimeStructuredPageRoutes(locals: Locals | null | undefined): Promise<RuntimeStructuredPageRouteRecord[]>
```

#### `listRuntimeSystemRoutes`
```ts
function listRuntimeSystemRoutes(locals: Locals | null | undefined): Promise<RuntimeSystemRouteRecord[]>
```

#### `saveRuntimeArchiveRoute`
```ts
function saveRuntimeArchiveRoute(pathname: string, input: { title: string; summary?: string | undefined; seoTitle?: string | undefined; metaDescription?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeArchiveRouteRecord; } | { ok: false; error: string; }>
```

#### `saveRuntimeSystemRoute`
```ts
function saveRuntimeSystemRoute(pathname: string, input: { title: string; summary?: string | undefined; bodyHtml?: string | undefined; settings?: Record<string, unknown> | null | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeSystemRouteRecord; } | { ok: false; error: string; }>
```

#### `createRuntimeStructuredPageRoute`
```ts
function createRuntimeStructuredPageRoute(pathname: string, input: { title: string; summary?: string | undefined; seoTitle?: string | undefined; metaDescription?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; ogImage?: string | undefined; templateKey: string; alternateLinks?: { hreflang: string; href: string; }[] | undefined; sections?: Record<string, unknown> | null | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeStructuredPageRouteRecord; } | { ok: false; error: string; }>
```

#### `saveRuntimeStructuredPageRoute`
```ts
function saveRuntimeStructuredPageRoute(pathname: string, input: { title: string; summary?: string | undefined; seoTitle?: string | undefined; metaDescription?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; ogImage?: string | undefined; templateKey: string; alternateLinks?: { hreflang: string; href: string; }[] | undefined; sections?: Record<string, unknown> | null | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeStructuredPageRouteRecord; } | { ok: false; error: string; }>
```

#### `createRuntimeContentRecord`
```ts
function createRuntimeContentRecord(input: { title: string; slug: string; legacyUrl?: string | undefined; status: string; body?: string | undefined; summary?: string | undefined; seoTitle: string; metaDescription: string; excerpt?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `saveRuntimeContentState`
```ts
function saveRuntimeContentState(slug: string, input: { title: string; status: string; scheduledAt?: string | undefined; body?: string | undefined; authorIds?: number[] | undefined; categoryIds?: number[] | undefined; tagIds?: number[] | undefined; seoTitle: string; metaDescription: string; excerpt?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; revisionNote?: string | undefined; lastKnownUpdatedAt?: string | undefined; metadata?: Record<string, unknown> | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `restoreRuntimeRevision`
```ts
function restoreRuntimeRevision(slug: string, revisionId: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `deleteRuntimeRedirectRule`
```ts
function deleteRuntimeRedirectRule(sourcePath: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimeRedirectRule`
```ts
function createRuntimeRedirectRule(input: { sourcePath: string; targetPath: string; statusCode: number; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `saveRuntimeSettings`
```ts
function saveRuntimeSettings(partial: Partial<SiteSettings>, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `updateRuntimeTranslationState`
```ts
function updateRuntimeTranslationState(route: string, state: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `getRuntimeInviteRequest`
```ts
function getRuntimeInviteRequest(rawToken: string, locals: Locals | null | undefined): Promise<{ email: string; name: string; role: "admin" | "editor"; expiresAt: string; } | null>
```

#### `getRuntimePasswordResetRequest`
```ts
function getRuntimePasswordResetRequest(rawToken: string, locals: Locals | null | undefined): Promise<{ email: string; name: string; role: "admin" | "editor"; expiresAt: string; } | null>
```

#### `inviteRuntimeAdminUser`
```ts
function inviteRuntimeAdminUser(input: { name: string; email: string; role: string; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `consumeRuntimeInviteToken`
```ts
function consumeRuntimeInviteToken(rawToken: string, password: string, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimePasswordResetToken`
```ts
function createRuntimePasswordResetToken(email: string, actor: Actor | null | undefined, locals: Locals | null | undefined): Promise<unknown>
```

#### `consumeRuntimePasswordResetToken`
```ts
function consumeRuntimePasswordResetToken(rawToken: string, password: string, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimeMediaAsset`
```ts
function createRuntimeMediaAsset(input: { filename: string; bytes: Uint8Array<ArrayBufferLike>; mimeType: string; title?: string | undefined; altText?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `updateRuntimeMediaAsset`
```ts
function updateRuntimeMediaAsset(input: { id: string; title?: string | undefined; altText?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `deleteRuntimeMediaAsset`
```ts
function deleteRuntimeMediaAsset(id: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimeAuthor`
```ts
function createRuntimeAuthor(input: { name: string; slug?: string | undefined; bio?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `updateRuntimeAuthor`
```ts
function updateRuntimeAuthor(input: { id: number; name: string; slug?: string | undefined; bio?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `deleteRuntimeAuthor`
```ts
function deleteRuntimeAuthor(id: number, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimeCategory`
```ts
function createRuntimeCategory(input: { name: string; slug?: string | undefined; description?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `updateRuntimeCategory`
```ts
function updateRuntimeCategory(input: { id: number; name: string; slug?: string | undefined; description?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `deleteRuntimeCategory`
```ts
function deleteRuntimeCategory(id: number, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `createRuntimeTag`
```ts
function createRuntimeTag(input: { name: string; slug?: string | undefined; description?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `updateRuntimeTag`
```ts
function updateRuntimeTag(input: { id: number; name: string; slug?: string | undefined; description?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `deleteRuntimeTag`
```ts
function deleteRuntimeTag(id: number, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `moderateRuntimeComment`
```ts
function moderateRuntimeComment(commentId: string, nextStatus: "pending" | "approved" | "rejected", actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `suspendRuntimeAdminUser`
```ts
function suspendRuntimeAdminUser(email: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `unsuspendRuntimeAdminUser`
```ts
function unsuspendRuntimeAdminUser(email: string, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
```

#### `moderateRuntimeTestimonial`
```ts
function moderateRuntimeTestimonial(id: string, status: TestimonialStatus, actor: { email: string; role: string; name: string; }, locals: Locals | null | undefined): Promise<{ ok: true; } | { ok: false; error: string; }>
```

#### `getRuntimeSessionUser`
```ts
function getRuntimeSessionUser(sessionToken: string | null | undefined, locals: Locals | null | undefined): Promise<SessionUser | null>
```

#### `getRuntimeCsrfToken`
```ts
function getRuntimeCsrfToken(sessionToken: string | null | undefined, locals: Locals | null | undefined): Promise<string | null>
```

#### `createRuntimeSession`
```ts
function createRuntimeSession(user: SessionUser, metadata: { ipAddress?: string | null | undefined; userAgent?: string | null | undefined; } | undefined, locals: Locals | null | undefined): Promise<string>
```

#### `revokeRuntimeSession`
```ts
function revokeRuntimeSession(sessionToken: string | null | undefined, locals: Locals | null | undefined): Promise<void>
```

#### `authenticateRuntimeAdminUser`
```ts
function authenticateRuntimeAdminUser(email: string, password: string, locals: Locals | null | undefined): Promise<SessionUser | null>
```

#### `recordRuntimeSuccessfulLogin`
```ts
function recordRuntimeSuccessfulLogin(actor: SessionUser, locals: Locals | null | undefined): Promise<void>
```

#### `recordRuntimeLogout`
```ts
function recordRuntimeLogout(actor: SessionUser, locals: Locals | null | undefined): Promise<void>
```

#### `buildAdminDashboardModel`
```ts
function buildAdminDashboardModel(locals: Locals, role: "admin" | "editor", translationStatus: TranslationEntry[], deps: DashboardDeps): Promise<AdminDashboardModel>
```

#### `buildAdminDashboardPageModel`
```ts
function buildAdminDashboardPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<AdminDashboardModel>>
```

#### `buildPagesIndexPageModel`
```ts
function buildPagesIndexPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ contentStates: ContentRecord[]; routePages: RuntimeStructuredPageRouteRecord[]; archiveRows: any[]; }>>
```

#### `buildPostsIndexPageModel`
```ts
function buildPostsIndexPageModel(locals: Locals): Promise<AdminPageResult<{ authors: AuthorRecord[]; categories: TaxonomyTerm[]; tags: TaxonomyTerm[]; allContent: ContentRecord[]; archives: { slug: string; title: string; listingItems: { href: string; }[]; }[]; }>>
```

#### `buildPostEditorPageModel`
```ts
function buildPostEditorPageModel(locals: Locals, slug: string): Promise<AdminPageResult<{ pageRecord: null; authors: never[]; categories: never[]; tags: never[]; auditEvents: never[]; englishOwnerRecord: null; localizedRouteRecord: null; effectiveTranslationState: undefined; }> | AdminPageResult<{ pageRecord: ContentRecord; authors: AuthorRecord[]; categories: TaxonomyTerm[]; tags: TaxonomyTerm[]; auditEvents: AuditEvent[]; englishOwnerRecord: ContentRecord | null; localizedRouteRecord: RuntimeStructuredPageRouteRecord | null; effectiveTranslationState: string | undefined; }>>
```

#### `buildPostRevisionsPageModel`
```ts
function buildPostRevisionsPageModel(locals: Locals, slug: string): Promise<AdminPageResult<{ pageRecord: null; revisions: null; auditEvents: never[]; authors: never[]; categories: never[]; tags: never[]; }> | AdminPageResult<{ pageRecord: ContentRecord; revisions: ContentRevision[]; auditEvents: AuditEvent[]; authors: AuthorRecord[]; categories: TaxonomyTerm[]; tags: TaxonomyTerm[]; }>>
```

#### `buildRouteTablePageModel`
```ts
function buildRouteTablePageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ routePages: RuntimeStructuredPageRouteRecord[]; settings: SiteSettings; }>>
```

#### `buildRoutePageEditorModel`
```ts
function buildRoutePageEditorModel(locals: Locals, routePath: string, role: AdminRole): Promise<AdminPageResult<{ pageRecord: RuntimeStructuredPageRouteRecord | null; englishOwner: ContentRecord | null; effectiveTranslationState: string | undefined; }>>
```

#### `buildArchivesIndexPageModel`
```ts
function buildArchivesIndexPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ archiveList: any[]; archivesByKind: Record<string, any[]>; kindCounts: { kind: string; count: number; }[]; totalArchives: number; totalItems: number; }>>
```

#### `buildArchiveEditorModel`
```ts
function buildArchiveEditorModel(locals: Locals, archivePath: string, role: AdminRole): Promise<AdminPageResult<{ archive: null; }> | AdminPageResult<{ archive: RuntimeArchiveRouteRecord; }>>
```

#### `buildSeoPageModel`
```ts
function buildSeoPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ rows: any[]; }>>
```

#### `buildMediaPageModel`
```ts
function buildMediaPageModel(locals: Locals): Promise<AdminPageResult<{ mediaWithResolvedUrls: { resolvedUrl: string; id: string; sourceUrl: string | null; localPath: string; r2Key: string | null; mimeType: string | null; width: number | null; height: number | null; fileSize: number | null; altText: string; title: string; uploadedAt: string; uploadedBy: string; thumbnailUrl?: string | null | undefined; srcset?: string | null | undefined; }[]; auditEvents: AuditEvent[]; }>>
```

#### `buildRedirectsPageModel`
```ts
function buildRedirectsPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ redirectRules: RedirectRule[]; auditEvents: AuditEvent[]; }>>
```

#### `buildAuthorsPageModel`
```ts
function buildAuthorsPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ authors: AuthorRecord[]; auditEvents: AuditEvent[]; }>>
```

#### `buildTaxonomiesPageModel`
```ts
function buildTaxonomiesPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ categories: TaxonomyTerm[]; tags: TaxonomyTerm[]; auditEvents: AuditEvent[]; }>>
```

#### `buildCommentsPageModel`
```ts
function buildCommentsPageModel(locals: Locals): Promise<AdminPageResult<{ comments: CommentRecord[]; auditEvents: AuditEvent[]; }>>
```

#### `buildTestimonialsPageModel`
```ts
function buildTestimonialsPageModel(locals: Locals): Promise<AdminPageResult<{ pending: TestimonialSubmission[]; approved: TestimonialSubmission[]; featured: TestimonialSubmission[]; auditEvents: AuditEvent[]; }>>
```

#### `buildTranslationsPageModel`
```ts
function buildTranslationsPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ rows: any[]; }>>
```

#### `buildSettingsPageModel`
```ts
function buildSettingsPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ settings: SiteSettings; }>>
```

#### `buildSystemPageModel`
```ts
function buildSystemPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ systemRoutes: RuntimeSystemRouteRecord[]; routeMap: Map<string, RuntimeSystemRouteRecord>; }>>
```

#### `buildUsersPageModel`
```ts
function buildUsersPageModel(locals: Locals, role: AdminRole): Promise<AdminPageResult<{ users: ManagedAdminUser[]; auditEvents: AuditEvent[]; }>>
```

#### `buildAcceptInvitePageModel`
```ts
function buildAcceptInvitePageModel(locals: Locals, token: string): Promise<AdminPageResult<{ inviteRequest: { email: string; name: string; role: "admin" | "editor"; expiresAt: string; } | null; }>>
```

#### `buildResetPasswordPageModel`
```ts
function buildResetPasswordPageModel(locals: Locals, token: string): Promise<AdminPageResult<{ request: { email: string; name: string; role: "admin" | "editor"; expiresAt: string; } | null; }>>
```

#### `withAdminFormAction`
```ts
function withAdminFormAction(context: APIContext<Record<string, any>, Record<string, string | undefined>>, options: GuardOptions, run: (action: ActionContext) => Response | Promise<Response>): Promise<Response>
```

#### `requireAdminFormAction`
```ts
function requireAdminFormAction(context: APIContext<Record<string, any>, Record<string, string | undefined>>, options: GuardOptions): Promise<GuardResult>
```

#### `actionRedirect`
```ts
function actionRedirect(location: string, status: number): Response
```

#### `actionErrorRedirect`
```ts
function actionErrorRedirect(path: string, message: string): Response
```

#### `triggerPublish`
```ts
function triggerPublish(config: DeployHookConfig): Promise<PublishTriggerResult>
```

#### `resolveDeployHookFromEnv`
```ts
function resolveDeployHookFromEnv(env: Record<string, string | undefined>): DeployHookConfig | null
```

#### `resolvePreviewPath`
```ts
function resolvePreviewPath(url: URL): { slug: string; } | null
```

#### `buildPreviewLoginRedirect`
```ts
function buildPreviewLoginRedirect(requestUrl: URL): string
```

#### `resolveSafeReturnPath`
```ts
function resolveSafeReturnPath(referer: string | null | undefined, fallbackPath: string): string
```

#### `appendQueryParam`
```ts
function appendQueryParam(path: string, key: string, value: string): string
```

#### `getAlternateLinksForEnglishRoute`
```ts
function getAlternateLinksForEnglishRoute(legacyUrl: string): { hreflang: string; href: string; }[]
```

#### `sanitizeCanonicalUrl`
```ts
function sanitizeCanonicalUrl(value: string | undefined, fallbackRoute: string): string
```

#### `canonicalUrlForRoute`
```ts
function canonicalUrlForRoute(route: string): string
```

#### `getLocaleSwitchTargets`
```ts
function getLocaleSwitchTargets(input: { lang: "en" | "es"; currentPath?: string | undefined; alternateLinks?: AlternateLink[] | undefined; }): { en: string; es: string; }
```

#### `getAdminLocalePair`
```ts
function getAdminLocalePair(route: string): AdminLocalePair | null
```

#### `localeFromPath`
```ts
function localeFromPath(pathname: string): string
```

#### `localeFromAcceptLanguage`
```ts
function localeFromAcceptLanguage(acceptLanguage: string | null | undefined): string
```

#### `isAstropressLocalRuntimeModuleRequest`
```ts
function isAstropressLocalRuntimeModuleRequest(id: string, localRuntimeModulesPath: string): boolean
```

#### `createAstropressLocalRuntimeModulePlugin`
```ts
function createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath: string): AstropressVitePlugin
```

#### `createAstropressViteAliases`
```ts
function createAstropressViteAliases(options: AstropressViteRuntimeAliasOptions): AstropressViteAlias[]
```

#### `createAstropressPackageResolverPlugin`
```ts
function createAstropressPackageResolverPlugin(astropressPackageRoot: string): AstropressVitePlugin
```

#### `createAstropressVitestLocalRuntimePlugins`
```ts
function createAstropressVitestLocalRuntimePlugins(localRuntimeModulesPath: string): AstropressVitestPlugin[]
```

#### `defineAstropressHostRuntimeModules`
```ts
function defineAstropressHostRuntimeModules(modules: AstropressHostRuntimeModules): AstropressHostRuntimeModules
```

#### `sanitizeHtml`
```ts
function sanitizeHtml(html: string): Promise<string>
```

#### `optimizeImageLoading`
```ts
function optimizeImageLoading(html: string): string
```

#### `isSeededPostRecord`
```ts
function isSeededPostRecord(record: SeededContentRecordLike): boolean
```

#### `isSeededPageRecord`
```ts
function isSeededPageRecord(record: SeededContentRecordLike): boolean
```

#### `getSeededAdminContentType`
```ts
function getSeededAdminContentType(record: SeededContentRecordLike): SeededAdminContentType
```

#### `resolveMediaUrl`
```ts
function resolveMediaUrl(record: MediaRecord, options: MediaResolutionOptions): string
```

#### `resolveRuntimeMediaUrl`
```ts
function resolveRuntimeMediaUrl(record: MediaRecord, locals: Locals | null | undefined): string
```

#### `getRuntimeMediaResolutionOptions`
```ts
function getRuntimeMediaResolutionOptions(locals: Locals | null | undefined): MediaResolutionOptions
```

#### `guessMediaMimeType`
```ts
function guessMediaMimeType(pathname: string): "image/svg+xml" | "image/png" | "image/webp" | "image/gif" | "image/avif" | "image/jpeg"
```

#### `guessImageMimeType`
```ts
function guessImageMimeType(pathname: string): "image/svg+xml" | "image/png" | "image/webp" | "image/gif" | "image/avif" | "image/jpeg"
```

#### `storeRuntimeMediaObject`
```ts
function storeRuntimeMediaObject(input: MediaUploadInput, locals: Locals | null | undefined): Promise<{ ok: false; error: string; } | { ok: true; asset: LocalMediaDescriptor; storage: "r2"; } | { ok: true; asset: LocalMediaDescriptor; storage: "local"; }>
```

#### `deleteRuntimeMediaObject`
```ts
function deleteRuntimeMediaObject(input: { localPath?: string | null | undefined; r2Key?: string | null | undefined; }, locals: Locals | null | undefined): Promise<void>
```

#### `sendTransactionalEmail`
```ts
function sendTransactionalEmail(message: EmailMessage, locals: Locals | null | undefined): Promise<EmailResult>
```

#### `sendPasswordResetEmail`
```ts
function sendPasswordResetEmail(email: string, resetUrl: string, locals: Locals | null | undefined): Promise<EmailResult>
```

#### `sendUserInviteEmail`
```ts
function sendUserInviteEmail(email: string, inviteUrl: string, locals: Locals | null | undefined): Promise<EmailResult>
```

#### `sendContactNotification`
```ts
function sendContactNotification(input: { name: string; email: string; message: string; submittedAt: string; }, locals: Locals | null | undefined): Promise<EmailResult>
```

#### `isTurnstileEnabled`
```ts
function isTurnstileEnabled(locals: Locals | null | undefined): boolean
```

#### `verifyTurnstileToken`
```ts
function verifyTurnstileToken(input: { token: string | null | undefined; ipAddress?: string | null | undefined; locals?: Locals | null | undefined; requireConfigured?: boolean | undefined; }): Promise<TurnstileVerificationResult>
```

#### `hashPassword`
```ts
function hashPassword(password: string, saltLength: number, iterations: number): Promise<string>
```

#### `verifyPassword`
```ts
function verifyPassword(password: string, storedHash: string): Promise<boolean>
```

#### `readLocalImageAsset`
```ts
function readLocalImageAsset(publicPath: string): { ok: false; error: string; asset?: undefined; } | { ok: true; asset: { diskPath: string; bytes: ArrayBuffer; mimeType: string; }; error?: undefined; }
```

#### `resolveLocalImageDiskPath`
```ts
function resolveLocalImageDiskPath(publicPath: string): string
```

#### `createAstropressGitHubPagesDeployTarget`
```ts
function createAstropressGitHubPagesDeployTarget(options: AstropressGitHubPagesDeployTargetOptions): DeployTarget
```

#### `createAstropressCloudflarePagesDeployTarget`
```ts
function createAstropressCloudflarePagesDeployTarget(options: AstropressCloudflarePagesDeployTargetOptions): DeployTarget
```

#### `createAstropressVercelDeployTarget`
```ts
function createAstropressVercelDeployTarget(options: AstropressVercelDeployTargetOptions): DeployTarget
```

#### `createAstropressNetlifyDeployTarget`
```ts
function createAstropressNetlifyDeployTarget(options: AstropressNetlifyDeployTargetOptions): DeployTarget
```

#### `createAstropressRenderDeployTarget`
```ts
function createAstropressRenderDeployTarget(options: AstropressRenderDeployTargetOptions): DeployTarget
```

#### `createAstropressGitLabPagesDeployTarget`
```ts
function createAstropressGitLabPagesDeployTarget(options: AstropressGitLabPagesDeployTargetOptions): DeployTarget
```

#### `createAstropressCustomDeployTarget`
```ts
function createAstropressCustomDeployTarget(options: AstropressCustomDeployTargetOptions): DeployTarget
```

#### `bootstrapAstropressContentServices`
```ts
function bootstrapAstropressContentServices(input: AstropressContentServicesBootstrapInput): Promise<AstropressContentServicesOperationReport>
```

#### `verifyAstropressContentServices`
```ts
function verifyAstropressContentServices(input: AstropressContentServicesVerifyInput): Promise<AstropressContentServicesOperationReport>
```

#### `runAstropressDbMigrationsForCli`
```ts
function runAstropressDbMigrationsForCli(input: AstropressDbMigrateInput): AstropressDbMigrateReport
```

### Types & Interfaces

- `interface AstropressPublicSiteOptions`
- `interface AstropressPlugin`
- `interface AstropressContentEvent`
- `interface AstropressMediaEvent`
- `interface FieldDefinition`
- `interface ContentTypeDefinition`
- `interface CmsConfig`
- `interface TestimonialsConfig`
- `type AstropressAdminNavKey`
- `interface AstropressResolvedAdminUiConfig`
- `type AstropressAdminRouteDefinition`
- `type AstropressAdminRouteInjector`
- `type AstropressAdminRouteKind`
- `interface AstropressBuildTimeLoaderOptions`
- `interface AstropressContentLoader`
- `type ProviderKind`
- `interface ProviderCapabilities`
- `interface AstropressCmsConfig`
- `interface AstropressHostPanelCapability`
- `type SaveableContentKind`
- `type ReadableContentKind`
- `interface ContentListOptions`
- `interface ContentStoreRecord`
- `interface ContentStore`
- `interface MediaAssetRecord`
- `interface MediaStore`
- `interface RevisionRecord`
- `interface RevisionStore`
- `interface AuthUser`
- `interface AuthStore`
- `interface GitSyncAdapter`
- `interface DeployTarget`
- `interface ImportSource`
- `interface AstropressWordPressImportArtifacts`
- `interface AstropressWordPressImportEntityCount`
- `interface AstropressWordPressImportInventory`
- `interface AstropressWordPressImportLocalApplyReport`
- `interface AstropressWordPressImportPlan`
- `interface AstropressWordPressImportReport`
- `interface PreviewSession`
- `interface AstropressPlatformAdapter`
- `type FirstPartyProviderTarget`
- `type AstropressAppHost`
- `interface AstropressAppHostTarget`
- `type AstropressDataServices`
- `interface AstropressDataServiceTarget`
- `interface AstropressDeploymentProfile`
- `interface AstropressDeploymentMatrixEntry`
- `type AstropressDeploymentSupportLevel`
- `interface AstropressInMemoryPlatformAdapterOptions`
- `interface AstropressProjectScaffold`
- `type AstropressScaffoldProvider`
- `interface AstropressProjectScaffoldInput`
- `type AstropressExistingPlatform`
- `interface AstropressProviderChoiceInput`
- `interface AstropressProviderChoiceRecommendation`
- `type AstropressProviderOpsComfort`
- `type AstropressAppHostEnv`
- `type AstropressContentServicesEnv`
- `type AstropressDataServicesEnv`
- `type AstropressDeployTargetEnv`
- `type AstropressHostedProviderEnv`
- `type AstropressLocalProviderEnv`
- `interface AstropressProjectEnvContract`
- `interface AstropressHostedPlatformAdapterOptions`
- `interface AstropressHostedApiAdapterOptions`
- `interface AstropressCloudflareAdapterOptions`
- `type AstropressHostedAdapterOptions`
- `type AstropressHostedProviderKind`
- `type AstropressSupabaseAdapterOptions`
- `interface AstropressSupabaseHostedAdapterOptions`
- `interface AstropressSupabaseHostedConfig`
- `type AstropressAppwriteAdapterOptions`
- `interface AstropressAppwriteHostedAdapterOptions`
- `interface AstropressAppwriteHostedConfig`
- `type AstropressPocketbaseAdapterOptions`
- `interface AstropressPocketbaseHostedAdapterOptions`
- `interface AstropressPocketbaseHostedConfig`
- `type AstropressTursoAdapterOptions`
- `interface AstropressTursoHostedAdapterOptions`
- `interface AstropressTursoHostedConfig`
- `type AstropressNeonAdapterOptions`
- `interface AstropressNeonHostedAdapterOptions`
- `interface AstropressNeonHostedConfig`
- `type AstropressNhostAdapterOptions`
- `interface AstropressNhostHostedAdapterOptions`
- `interface AstropressNhostHostedConfig`
- `type AdminRole`
- `type ContentStatus`
- `type CommentStatus`
- `type CommentPolicy`
- `type TaxonomyKind`
- `interface SessionUser`
- `interface Actor`
- `interface AuditEvent`
- `interface RedirectRule`
- `interface CommentRecord`
- `interface ContentOverride`
- `interface ContentRecord`
- `interface ContentRevision`
- `interface ContactSubmission`
- `type TestimonialStatus`
- `type TestimonialSource`
- `interface TestimonialSubmission`
- `interface TestimonialSubmissionInput`
- `interface InviteRequest`
- `interface PasswordResetRequest`
- `interface ManagedAdminUser`
- `interface MediaAsset`
- `interface AuthorRecord`
- `interface TaxonomyTerm`
- `interface AdminStoreAdapter`
- `interface AuditRepository`
- `interface AuthRepository`
- `interface AuthorRepository`
- `interface ContentRepository`
- `interface TaxonomyRepository`
- `interface RedirectRepository`
- `interface CommentRepository`
- `interface SubmissionRepository`
- `interface TranslationRepository`
- `interface SettingsRepository`
- `interface RateLimitRepository`
- `interface MediaRepository`
- `interface UserRepository`
- `interface SiteSettings`
- `type TranslationState`
- `interface D1DatabaseLike`
- `interface D1PreparedStatement`
- `interface D1Result`
- `interface D1AdminReadStore`
- `interface D1AdminMutationStore`
- `interface RuntimeBindings`
- `interface R2BucketLike`
- `interface R2ObjectBodyLike`
- `type AstropressSecurityArea`
- `interface AstropressSecurityHeadersOptions`
- `interface AstropressSecurityMiddlewareOptions`
- `type AdminDashboardModel`
- `type AdminPageResult`
- `interface PublishTriggerResult`
- `type DeployHookType`
- `interface DeployHookConfig`
- `interface AdminPreviewRequest`
- `interface AdminPreviewContext`
- `interface AdminLocalePair`
- `type AstropressViteRuntimeAliasOptions`
- `type AstropressVitePlugin`
- `type AstropressViteAlias`
- `type AstropressVitestPlugin`
- `interface AstropressHostRuntimeModules`
- `interface LocalAdminStoreModule`
- `interface LocalAdminAuthModule`
- `interface LocalCmsRegistryModule`
- `interface LocalMediaStorageModule`
- `interface LocalImageStorageModule`
- `interface SeededContentRecordLike`
- `type SeededAdminContentType`
- `interface MediaRecord`
- `interface NewsletterAdapter`
- `interface AstropressContentServicesBootstrapInput`
- `interface AstropressContentServicesVerifyInput`
- `interface AstropressContentServicesOperationReport`
- `interface AstropressDbMigrateInput`
- `interface AstropressDbMigrateReport`

### Constants & Re-exports

- `const PROVIDER_CONTRACT_VERSION: "0.1"`
- `const ASTROPRESS_ADMIN_APP_NAME: "Astropress"`
- `const ASTROPRESS_ADMIN_PRODUCT_NAME: "Astropress Admin"`
- `const ASTROPRESS_ADMIN_BASE_PATH: "/ap-admin"`
- `const defaultSiteSettings: SiteSettings`
- `const translationStates: readonly ["not_started", "partial", "fallback_en", "translated", "reviewed", "published"]`
- `const newsletterAdapter: NewsletterAdapter`
- `const placeholderAdapter: NewsletterAdapter`

---

## `astropress (config)`

### Functions

#### `peekCmsConfig`
```ts
function peekCmsConfig(): CmsConfig | null
```

#### `reportAstropressError`
```ts
function reportAstropressError(error: unknown, context: string): Promise<void>
```

### Types & Interfaces

- `interface AbTestingConfig`
- `interface AnalyticsConfig`
- `interface AstropressApiConfig`
- `interface DonationsConfig`
- `interface GiveLivelyConfig`
- `interface LiberapayConfig`
- `interface PledgeCryptoConfig`

---

## `astropress/platform-contracts`

### Types & Interfaces

- `type ContentId` — A content record ID — prevents mixing with media or user IDs.
- `type MediaAssetId` — A media asset ID — prevents mixing with content or user IDs.
- `type AdminUserId` — An admin user ID — prevents mixing with content or media IDs.
- `type ApiTokenId` — An API token ID — prevents mixing with other ID types.
- `type AuditEventId` — An audit event ID — prevents mixing with content or user IDs.
- `type ActionResult` — Standard discriminated union for all repository / action operation results.
- `type ApiScope`
- `interface ApiTokenRecord`
- `interface ApiTokenStore`
- `type WebhookEvent`
- `interface WebhookRecord`
- `interface WebhookStore`
- `interface FaqItem` — A single FAQ item for AEO-optimised FAQPage JSON-LD.
- `interface HowToStep` — A single step in a HowTo guide for AEO-optimised HowTo JSON-LD.
- `interface AeoMetadata` — AEO (Answer Engine Optimisation) metadata that can be stored in a content record's `metadata` field to trigger automatic JSON-LD rendering via AstropressContentLayout.

---

## `astropress/api-middleware`

### Functions

#### `jsonOk`
```ts
function jsonOk(body: JsonValue, status: number): Response
```

#### `jsonOkWithEtag`
```ts
function jsonOkWithEtag(body: JsonValue, request: Request, status: number): Response
```

#### `jsonOkPaginated`
```ts
function jsonOkPaginated(body: JsonValue, total: number, status: number): Response
```

#### `handleCorsPreflightRequest`
```ts
function handleCorsPreflightRequest(request: Request): Response | null
```

#### `withApiRequest`
```ts
function withApiRequest(request: Request, ctx: ApiRequestContext, requiredScopes: ApiScope[], handler: (tokenId: string) => Promise<Response>): Promise<Response>
```

### Types & Interfaces

- `interface ApiRequestContext`

### Constants & Re-exports

- `apiErrors`

---

## `astropress/admin-ui`

### Functions

#### `getAdminLabel`
```ts
function getAdminLabel(key: AdminLabelKey, locale: string | undefined): string
```

Resolve a localised admin UI label. Falls back through: `locale` -> first site locale from config -> `"en"`. Unknown keys return `key` so missing translations are visible rather than blank.

### Types & Interfaces

- `type AdminLocale`
- `type AdminLabelKey`

### Constants & Re-exports

- `const adminLabels: Record<AdminLocale, Record<AdminLabelKey, string>>`

---

## `astropress/d1-migrate-ops`

### Functions

#### `runD1Migrations`
```ts
function runD1Migrations(input: D1MigrateInput): Promise<D1MigrateReport>
```

Applies pending schema migrations to a Cloudflare D1 database. Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`). They are applied in lexicographic order. Applied migrations are recorded in `schema_migrations` so they are never re-run. Companion `.down.sql` files are read alongside each migration and stored as `rollback_sql` in `schema_migrations`, enabling `rollbackD1LastMigration`. In `dryRun` mode no writes are performed — the function returns what would have been applied.

#### `rollbackD1LastMigration`
```ts
function rollbackD1LastMigration(db: D1DatabaseLike, __1: { dryRun?: boolean | undefined; }): Promise<D1RollbackReport>
```

Rolls back the most recently applied D1 migration using its stored `rollback_sql`. Executes the rollback SQL as a batch and removes the migration record. If the last migration has no rollback SQL, returns `status: "no_rollback_sql"` without modifying the database.

### Types & Interfaces

- `interface D1MigrateInput`
- `interface D1MigrateReport`
- `type D1RollbackStatus`
- `interface D1RollbackReport`

---

## `astropress/db-migrate-ops`

### Functions

#### `rollbackAstropressLastMigration`
```ts
function rollbackAstropressLastMigration(input: AstropressDbRollbackInput): AstropressDbRollbackReport
```

Rolls back the last applied schema migration using its stored `rollback_sql`. Reads the most recently applied migration from `schema_migrations`, executes its `rollback_sql`, then deletes the migration record. If no `rollback_sql` was stored (i.e. the migration has no companion `.down.sql` file), returns `status: "no_rollback_sql"` without modifying the database.

### Types & Interfaces

- `interface AstropressDbRollbackInput`
- `type AstropressDbRollbackStatus`
- `interface AstropressDbRollbackReport`

---

## `astropress/sqlite-bootstrap`

### Functions

#### `resolveAstropressSqliteSchemaPath`
```ts
function resolveAstropressSqliteSchemaPath(): string
```

#### `readAstropressSqliteSchemaSql`
```ts
function readAstropressSqliteSchemaSql(): string
```

#### `runAstropressMigrations`
```ts
function runAstropressMigrations(db: SqliteDatabaseLike, migrationsDir: string): { applied: string[]; skipped: string[]; }
```

Run incremental SQL migrations from a directory against a live SQLite database. Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`). They are applied in lexicographic order. Applied migrations are recorded in `schema_migrations` so they are never re-run.

#### `checkSchemaVersionAhead`
```ts
function checkSchemaVersionAhead(db: SqliteDatabaseLike, frameworkBaseline: number): { isAhead: boolean; dbCount: number; frameworkCount: number; } | null
```

Checks whether the database `schema_migrations` table has more entries than the framework's known baseline.

#### `rollbackAstropressLastMigrationWithOptions`
```ts
function rollbackAstropressLastMigrationWithOptions(db: SqliteDatabaseLike, options: { dryRun?: boolean | undefined; }): AstropressRollbackResult
```

#### `createAstropressSqliteSeedToolkit`
```ts
function createAstropressSqliteSeedToolkit<TableName>(options: AstropressSqliteSeedToolkitOptions<TableName>): AstropressSqliteSeedToolkit<TableName>
```

#### `createDefaultAstropressSqliteSeedToolkit`
```ts
function createDefaultAstropressSqliteSeedToolkit(): AstropressSqliteSeedToolkit<"comments" | "admin_users" | "media_assets" | "redirect_rules" | "site_settings" | "cms_route_groups" | "cms_route_variants" | "cms_route_aliases" | "cms_route_revisions">
```

### Types & Interfaces

- `interface SqliteStatementLike`
- `interface SqliteDatabaseLike`
- `interface MediaSeedRecord`
- `interface RedirectRuleSeed`
- `interface SeededComment`
- `interface BootstrapUserSeed`
- `interface SystemRouteSeed`
- `interface ArchiveSeedRecord`
- `interface MarketingRouteSeedRecord`
- `interface SiteSettingsSeed`
- `interface SeedDatabaseOptions`
- `interface SeedSummary`
- `interface SeedImportStatement`
- `interface AstropressSqliteSeedToolkitOptions`
- `interface AstropressSqliteSeedToolkit`
- `type AstropressRollbackStatus`
- `interface AstropressRollbackResult`

### Constants & Re-exports

- `const defaultSeedImportTables: readonly ["admin_users", "media_assets", "redirect_rules", "comments", "site_settings", "cms_route_groups", "cms_route_variants", "cms_route_aliases", "cms_route_revisions"]`
- `const ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE: 1` — The number of framework-owned migrations Astropress applies during bootstrapping. Used by `checkSchemaVersionAhead` to detect host-app migrations.

---

## `astropress (cache-purge)`

### Functions

#### `purgeCdnCache`
```ts
function purgeCdnCache(slug: string, config: CmsConfig): Promise<void>
```

Purges CDN cache for a specific content slug after it is published. Supports three purge strategies: 1. Generic webhook — POST `{ slug, purgedAt }` to `config.cdnPurgeWebhook` 2. Cloudflare Cache API — uses CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN env vars 3. Both can be active simultaneously (webhook fires after Cloudflare API call) Failures are non-fatal: errors are logged with `console.warn` but never thrown, so a CDN purge failure never blocks a content publish operation.

---

## `astropress/analytics`

### Functions

#### `resolveAnalyticsSnippet`
```ts
function resolveAnalyticsSnippet(config: AnalyticsConfig | null | undefined): string
```

Resolves the analytics tracking snippet for the configured provider. Returns an HTML string (a `<script>` tag) that should be placed in the `<head>` of the host layout. Returns an empty string if analytics is not configured or if the mode is "iframe" or "link" (embed-only, no snippet). For the "custom" type, the snippet is passed through as-is. For all other types, the snippet is built from the config fields.

#### `requestOptedOutOfTracking`
```ts
function requestOptedOutOfTracking(request: Request): boolean
```

Returns true if the incoming request signals that the user has opted out of tracking, either via the `DNT: 1` (Do Not Track) header or the newer `Sec-GPC: 1` (Global Privacy Control) header. Operators should call this before injecting analytics snippets and skip tracking when it returns `true`.

#### `resolveAnalyticsSnippetConsentAware`
```ts
function resolveAnalyticsSnippetConsentAware(config: AnalyticsConfig | null | undefined, request: Request): string
```

Like `resolveAnalyticsSnippet`, but returns an empty string when the request carries a `DNT: 1` or `Sec-GPC: 1` header — honoring the user's opt-out.

---

## `astropress/integration`

### Functions

#### `createAstropressSitemapIntegration`
```ts
function createAstropressSitemapIntegration(options: AstropressSitemapOptions): AstroIntegration
```

createAstropressSitemapIntegration A thin Astro integration wrapper around the framework's built-in sitemap page (`/sitemap.xml`). It ensures the sitemap is injected with the correct canonical URL configuration. Use this when you prefer the named integration pattern (`integrations: [...]`) rather than calling `createAstropressPublicSiteIntegration()` which injects all public routes at once.

### Types & Interfaces

- `interface AstropressSitemapOptions`

---
