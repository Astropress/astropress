# Astropress API Reference

Auto-generated from TypeScript source. Run `bun run scripts/generate-api-docs.ts` to regenerate.

Generated: 2026-04-11

---

## `astropress`

### Exported constants / re-exports

- `PROVIDER_CONTRACT_VERSION`

---

## `astropress → ./src/public-site-integration.js`

### Exported constants / re-exports

- `createAstropressPublicSiteIntegration`

---

## `astropress → ./src/config`

### Exported constants / re-exports

- `registerCms`
- `getCmsConfig`
- `dispatchPluginContentEvent`
- `dispatchPluginMediaEvent`
- `validateContentFields`

---

## `astropress → ./src/admin-branding.js`

### Exported constants / re-exports

- `ASTROPRESS_ADMIN_APP_NAME`
- `ASTROPRESS_ADMIN_PRODUCT_NAME`
- `buildAstropressAdminDocumentTitle`

---

## `astropress → ./src/admin-ui.js`

### Exported constants / re-exports

- `resolveAstropressAdminUiConfig`

---

## `astropress → ./src/admin-slug-cache`

### Exported constants / re-exports

- `invalidateAstropressAdminSlugCache`
- `resolveAstropressAdminSlug`

---

## `astropress → ./src/admin-routes.js`

### Exported constants / re-exports

- `ASTROPRESS_ADMIN_BASE_PATH`
- `createAstropressAdminRouteInjectionPlan`
- `injectAstropressAdminRoutes`
- `listAstropressAdminRoutes`
- `resolveAstropressAdminRouteEntrypoints`

---

## `astropress → ./src/build-time-content-loader.js`

### Exported constants / re-exports

- `createAstropressBuildTimeLoader`

---

## `astropress → ./src/platform-contracts`

### Exported constants / re-exports

- `normalizeProviderCapabilities`
- `assertProviderContract`

---

## `astropress → ./src/provider-targets`

### Exported constants / re-exports

- `listFirstPartyProviderTargets`
- `getFirstPartyProviderTarget`

---

## `astropress → ./src/app-host-targets`

### Exported constants / re-exports

- `listAstropressAppHosts`
- `getAstropressAppHostTarget`

---

## `astropress → ./src/data-service-targets`

### Exported constants / re-exports

- `listAstropressDataServiceTargets`
- `getAstropressDataServiceTarget`

---

## `astropress → ./src/deployment-matrix`

### Exported constants / re-exports

- `listAstropressDeploymentMatrixEntries`
- `getAstropressDeploymentMatrixEntry`
- `resolveAstropressDeploymentSupportLevel`

---

## `astropress → ./src/in-memory-platform-adapter.js`

### Exported constants / re-exports

- `createAstropressInMemoryPlatformAdapter`

---

## `astropress → ./src/project-scaffold.js`

### Exported constants / re-exports

- `createAstropressProjectScaffold`

---

## `astropress → ./src/provider-choice.js`

### Exported constants / re-exports

- `recommendAstropressProvider`

---

## `astropress → ./src/project-env.js`

### Exported constants / re-exports

- `resolveAstropressAppHostFromEnv`
- `resolveAstropressDataServicesFromEnv`
- `resolveAstropressDeployTarget`
- `resolveAstropressHostedProviderFromEnv`
- `resolveAstropressLocalProviderFromEnv`
- `resolveAstropressProjectEnvContract`
- `resolveAstropressServiceOriginFromEnv`

---

## `astropress → ./src/hosted-platform-adapter.js`

### Exported constants / re-exports

- `createAstropressHostedPlatformAdapter`

---

## `astropress → ./src/hosted-api-adapter.js`

### Exported constants / re-exports

- `createAstropressHostedApiAdapter`

---

## `astropress → ./src/adapters/cloudflare.js`

### Exported constants / re-exports

- `createAstropressCloudflareAdapter`

---

## `astropress → ./src/adapters/hosted.js`

### Exported constants / re-exports

- `createAstropressHostedAdapter`
- `resolveAstropressHostedProvider`

---

## `astropress → ./src/adapters/supabase.js`

### Exported constants / re-exports

- `createAstropressSupabaseAdapter`
- `createAstropressSupabaseHostedAdapter`
- `readAstropressSupabaseHostedConfig`

---

## `astropress → ./src/adapters/appwrite.js`

### Exported constants / re-exports

- `createAstropressAppwriteAdapter`
- `createAstropressAppwriteHostedAdapter`
- `readAstropressAppwriteHostedConfig`

---

## `astropress → ./src/adapters/pocketbase.js`

### Exported constants / re-exports

- `createAstropressPocketbaseAdapter`
- `createAstropressPocketbaseHostedAdapter`
- `readAstropressPocketbaseHostedConfig`

---

## `astropress → ./src/adapters/runway.js`

### Exported constants / re-exports

- `createAstropressRunwayAdapter`
- `createAstropressRunwayHostedAdapter`
- `readAstropressRunwayHostedConfig`

---

## `astropress → ./src/site-settings`

### Exported constants / re-exports

- `defaultSiteSettings`

---

## `astropress → ./src/translation-state`

### Exported constants / re-exports

- `normalizeTranslationState`
- `isPublishedTranslationState`
- `translationStates`

---

## `astropress → ./src/d1-admin-store`

### Exported constants / re-exports

- `createD1AdminReadStore`
- `createD1AdminMutationStore`

---

## `astropress → ./src/runtime-env`

### Exported constants / re-exports

- `getRuntimeEnv`
- `isProductionRuntime`
- `getCloudflareBindings`
- `getStringRuntimeValue`
- `getNewsletterConfig`
- `getTransactionalEmailConfig`
- `getAdminBootstrapConfig`
- `getLoginSecurityConfig`
- `getTurnstileSiteKey`

---

## `astropress → ./src/security-headers.js`

### Exported constants / re-exports

- `applyAstropressSecurityHeaders`
- `createAstropressSecureRedirect`
- `createAstropressSecurityHeaders`
- `isTrustedRequestOrigin`

---

## `astropress → ./src/security-middleware.js`

### Exported constants / re-exports

- `createAstropressSecurityMiddleware`
- `resolveAstropressSecurityArea`

---

## `astropress → ./src/runtime-page-store`

### Exported constants / re-exports

- `getRuntimeSettings`
- `getRuntimeContentStateByPath`
- `getRuntimeRedirectRules`
- `listRuntimeContentStates`
- `getRuntimeAuthors`
- `getRuntimeCategories`
- `getRuntimeTags`
- `getRuntimeComments`
- `getRuntimeAuditEvents`
- `getRuntimeAdminUsers`
- `getRuntimeMediaAssets`
- `getRuntimeContentState`
- `getRuntimeContentRevisions`
- `getRuntimeTranslationState`
- `getRuntimeContactSubmissions`
- `checkRuntimeRateLimit`
- `peekRuntimeRateLimit`
- `recordRuntimeFailedAttempt`
- `submitRuntimeContact`
- `submitRuntimePublicComment`

---

## `astropress → ./src/runtime-route-registry`

### Exported constants / re-exports

- `getRuntimeStructuredPageRoute`
- `getRuntimeArchiveRoute`
- `getRuntimeSystemRoute`
- `listRuntimeStructuredPageRoutes`
- `listRuntimeSystemRoutes`
- `saveRuntimeArchiveRoute`
- `saveRuntimeSystemRoute`
- `createRuntimeStructuredPageRoute`
- `saveRuntimeStructuredPageRoute`

---

## `astropress → ./src/runtime-admin-actions`

### Exported constants / re-exports

- `createRuntimeContentRecord`
- `saveRuntimeContentState`
- `restoreRuntimeRevision`
- `deleteRuntimeRedirectRule`
- `createRuntimeRedirectRule`
- `saveRuntimeSettings`
- `updateRuntimeTranslationState`
- `getRuntimeInviteRequest`
- `getRuntimePasswordResetRequest`
- `inviteRuntimeAdminUser`
- `consumeRuntimeInviteToken`
- `createRuntimePasswordResetToken`
- `consumeRuntimePasswordResetToken`
- `createRuntimeMediaAsset`
- `updateRuntimeMediaAsset`
- `deleteRuntimeMediaAsset`
- `createRuntimeAuthor`
- `updateRuntimeAuthor`
- `deleteRuntimeAuthor`
- `createRuntimeCategory`
- `updateRuntimeCategory`
- `deleteRuntimeCategory`
- `createRuntimeTag`
- `updateRuntimeTag`
- `deleteRuntimeTag`
- `moderateRuntimeComment`
- `suspendRuntimeAdminUser`
- `unsuspendRuntimeAdminUser`

---

## `astropress → ./src/runtime-admin-auth`

### Exported constants / re-exports

- `getRuntimeSessionUser`
- `getRuntimeCsrfToken`
- `createRuntimeSession`
- `revokeRuntimeSession`
- `authenticateRuntimeAdminUser`
- `recordRuntimeSuccessfulLogin`
- `recordRuntimeLogout`

---

## `astropress → ./src/admin-dashboard`

### Exported constants / re-exports

- `buildAdminDashboardModel`

---

## `astropress → ./src/admin-page-models`

### Exported constants / re-exports

- `buildAdminDashboardPageModel`
- `buildPagesIndexPageModel`
- `buildPostsIndexPageModel`
- `buildPostEditorPageModel`
- `buildPostRevisionsPageModel`
- `buildRouteTablePageModel`
- `buildRoutePageEditorModel`
- `buildArchivesIndexPageModel`
- `buildArchiveEditorModel`
- `buildSeoPageModel`
- `buildMediaPageModel`
- `buildRedirectsPageModel`
- `buildAuthorsPageModel`
- `buildTaxonomiesPageModel`
- `buildCommentsPageModel`
- `buildTranslationsPageModel`
- `buildSettingsPageModel`
- `buildSystemPageModel`
- `buildUsersPageModel`
- `buildAcceptInvitePageModel`
- `buildResetPasswordPageModel`

---

## `astropress → ./src/admin-action-utils`

### Exported constants / re-exports

- `withAdminFormAction`
- `requireAdminFormAction`
- `actionRedirect`
- `actionErrorRedirect`

---

## `astropress → ./src/admin-action-publish.js`

### Exported constants / re-exports

- `triggerPublish`
- `resolveDeployHookFromEnv`

---

## `astropress → ./src/admin-preview-middleware.js`

### Exported constants / re-exports

- `resolvePreviewPath`
- `buildPreviewLoginRedirect`

---

## `astropress → ./src/return-path`

### Exported constants / re-exports

- `resolveSafeReturnPath`
- `appendQueryParam`

---

## `astropress → ./src/locale-links`

### Exported constants / re-exports

- `getAlternateLinksForEnglishRoute`
- `sanitizeCanonicalUrl`
- `canonicalUrlForRoute`
- `getLocaleSwitchTargets`

---

## `astropress → ./src/admin-locale-links`

### Exported constants / re-exports

- `getAdminLocalePair`

---

## `astropress → ./src/sqlite-runtime/utils`

### Exported constants / re-exports

- `localeFromPath`
- `localeFromAcceptLanguage`

---

## `astropress → ./src/vite-runtime-alias`

### Exported constants / re-exports

- `isAstropressLocalRuntimeModuleRequest`
- `createAstropressLocalRuntimeModulePlugin`
- `createAstropressViteAliases`

---

## `astropress → ./src/vitest-runtime-alias`

### Exported constants / re-exports

- `createAstropressVitestLocalRuntimePlugins`

---

## `astropress → ./src/host-runtime-modules`

### Exported constants / re-exports

- `defineAstropressHostRuntimeModules`

---

## `astropress → ./src/html-sanitization`

### Exported constants / re-exports

- `sanitizeHtml`

---

## `astropress → ./src/html-optimization`

### Exported constants / re-exports

- `optimizeImageLoading`

---

## `astropress → ./src/seeded-content-type`

### Exported constants / re-exports

- `isSeededPostRecord`
- `isSeededPageRecord`
- `getSeededAdminContentType`

---

## `astropress → ./src/media`

### Exported constants / re-exports

- `resolveMediaUrl`
- `resolveRuntimeMediaUrl`
- `getRuntimeMediaResolutionOptions`

---

## `astropress → ./src/local-media-storage`

### Exported constants / re-exports

- `guessMediaMimeType`

---

## `astropress → ./src/local-image-storage`

### Exported constants / re-exports

- `guessImageMimeType`
- `readLocalImageAsset`
- `resolveLocalImageDiskPath`

---

## `astropress → ./src/runtime-media-storage`

### Exported constants / re-exports

- `storeRuntimeMediaObject`
- `deleteRuntimeMediaObject`

---

## `astropress → ./src/newsletter-adapter`

### Exported constants / re-exports

- `newsletterAdapter`
- `placeholderAdapter`

---

## `astropress → ./src/transactional-email`

### Exported constants / re-exports

- `sendTransactionalEmail`
- `sendPasswordResetEmail`
- `sendUserInviteEmail`
- `sendContactNotification`

---

## `astropress → ./src/turnstile`

### Exported constants / re-exports

- `isTurnstileEnabled`
- `verifyTurnstileToken`

---

## `astropress → ./src/crypto-utils`

### Exported constants / re-exports

- `hashPassword`
- `verifyPassword`

---

## `astropress → ./src/deploy/github-pages.js`

### Exported constants / re-exports

- `createAstropressGitHubPagesDeployTarget`

---

## `astropress → ./src/deploy/cloudflare-pages.js`

### Exported constants / re-exports

- `createAstropressCloudflarePagesDeployTarget`

---

## `astropress → ./src/deploy/vercel.js`

### Exported constants / re-exports

- `createAstropressVercelDeployTarget`

---

## `astropress → ./src/deploy/netlify.js`

### Exported constants / re-exports

- `createAstropressNetlifyDeployTarget`

---

## `astropress → ./src/deploy/render.js`

### Exported constants / re-exports

- `createAstropressRenderDeployTarget`

---

## `astropress → ./src/deploy/gitlab-pages.js`

### Exported constants / re-exports

- `createAstropressGitLabPagesDeployTarget`

---

## `astropress → ./src/deploy/custom.js`

### Exported constants / re-exports

- `createAstropressCustomDeployTarget`

---

## `astropress → ./src/content-services-ops.js`

### Exported constants / re-exports

- `bootstrapAstropressContentServices`
- `verifyAstropressContentServices`

---

## `astropress → ./src/db-migrate-ops.js`

### Exported constants / re-exports

- `runAstropressDbMigrationsForCli`

---

## `astropress (config)`

### Functions

#### `peekCmsConfig`
```ts
function peekCmsConfig()
```
Retrieve the registered astropress configuration. Throws if `registerCms()` has not been called yet. @example ```ts import { getCmsConfig } from "astropress"; const { siteUrl } = getCmsConfig(); ```

### Types & Interfaces

- `interface FieldDefinition` — A single field in a content type definition. @example ```ts const titleField: FieldDefinition = { name: "subtitle", type: "text", label: "Subtitle", required: true, validate: (value) => value.length <= 120 || "Subtitle must be 120 characters or fewer", }; ```
- `interface ContentTypeDefinition` — A content type definition that associates a `templateKey` with a set of typed field definitions. Field values are stored in the `metadata` JSON column and validated at save time. @example ```ts registerCms({ contentTypes: [ { key: "event", label: "Event", fields: [ { name: "eventDate", label: "Event Date", type: "date", required: true }, { name: "venue", label: "Venue", type: "text" }, { name: "capacity", label: "Max Capacity", type: "number", validate: (v) => Number(v) > 0 || "Capacity must be a positive number", }, ], }, ], // ... }); ```
- `interface AstropressContentEvent` — Payload passed to lifecycle event hooks.
- `interface AstropressMediaEvent` — Email of the admin user who performed the action.
- `interface AstropressPlugin` — A plugin that extends Astropress with lifecycle hooks or admin navigation items. Plugins are registered via `registerCms({ plugins: [myPlugin] })`. Hook functions are called on the server — async is supported. @example ```ts const searchPlugin: AstropressPlugin = { name: "search-indexer", async onContentSave({ slug, status }) { if (status === "published") { await searchIndex.upsert(slug); } }, }; registerCms({ ..., plugins: [searchPlugin] }); ```
- `interface AnalyticsConfig` — File path or package-relative entrypoint for the page.
- `interface AbTestingConfig` — Override the display label shown in the sidebar.
- `interface AstropressApiConfig` — Override the display label shown in the sidebar.
- `interface CmsConfig` — CmsConfig — the single seam between astropress and the host site. Call registerCms() once at startup (e.g. in src/site/cms-registration.ts imported by middleware or the admin layout) before any astropress function is invoked.

---

## `astropress (platform-contracts)`

### Types & Interfaces

- `interface AstropressCmsConfig` — Configuration for the editorial CMS panel embedded in the admin.
- `interface AstropressHostPanelCapability` — Database provider infrastructure panel declaration.
- `interface ProviderCapabilities` — Label shown in the admin sidebar (e.g. "Supabase Studio").
- `interface ApiTokenRecord` — Env var names that must be set for the hook to be active.
- `interface ApiTokenStore` — Env var names that must be set for the hook to be active.
- `interface WebhookRecord` — Env var names that must be set for the hook to be active.
- `interface WebhookStore` — Env var names that must be set for the hook to be active.
- `interface FaqItem` — A single FAQ item for AEO-optimised FAQPage JSON-LD.
- `interface HowToStep` — A single step in a HowTo guide for AEO-optimised HowTo JSON-LD.
- `interface AeoMetadata` — AEO (Answer Engine Optimisation) metadata that can be stored in a content record's `metadata` field to trigger automatic JSON-LD rendering via AstropressContentLayout.
- `interface ContentStoreRecord` — ISO 8601 duration for the HowTo total time (e.g. "PT30M").
- `interface ContentListOptions` — ISO 8601 datetime. When set and status is draft, content is scheduled for auto-publish.
- `interface ContentStore` — Number of records to skip (for pagination).
- `interface MediaAssetRecord` — Number of records to skip (for pagination).
- `interface MediaStore` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface RevisionRecord` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface RevisionStore` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface AuthUser` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface AuthStore` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface GitSyncAdapter` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface DeployTarget` — Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px.
- `interface ImportSource` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportEntityCount` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportInventory` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportPlan` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportArtifacts` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportLocalApplyReport` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressWordPressImportReport` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface PreviewSession` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `interface AstropressPlatformAdapter` — Trigger a new build/deployment without requiring a local build directory. Used by the admin Publish button to kick off a CI/CD rebuild.
- `type ProviderKind`
- `type ApiScope` — Env var names that must be set for the hook to be active.
- `type WebhookEvent` — Env var names that must be set for the hook to be active.
- `type SaveableContentKind` — Kinds that can be written via ContentStore.save.
- `type ReadableContentKind` — All kinds that can be read via ContentStore.list/get (superset of SaveableContentKind).

---

## `astropress/api-middleware`

### Functions

#### `jsonOk`
```ts
function jsonOk(body: JsonValue, status = 200)
```

#### `jsonOkWithEtag`
```ts
function jsonOkWithEtag(body: JsonValue, request: Request, status = 200)
```
Generate a weak ETag from the serialized body using a fast djb2-style hash.

#### `jsonOkPaginated`
```ts
function jsonOkPaginated(body: JsonValue, total: number, status = 200)
```
Generate a weak ETag from the serialized body using a fast djb2-style hash.

#### `withApiRequest`
```ts
function withApiRequest(
  request: Request,
  ctx: ApiRequestContext,
  requiredScopes: ApiScope[],
  handler: (tokenId: string)
```
Generate a weak ETag from the serialized body using a fast djb2-style hash.

### Types & Interfaces

- `interface ApiRequestContext`

### Exported constants / re-exports

- `apiErrors` — Generate a weak ETag from the serialized body using a fast djb2-style hash.

---

## `astropress (admin-ui)`

### Functions

#### `getAdminLabel`
```ts
function getAdminLabel(key: AdminLabelKey, locale?: string)
```
Resolve a localised admin UI label. Falls back through: `locale` → first site locale from config → `"en"`. Unknown keys return `key` so missing translations are visible rather than blank. @param key    The label key (e.g. `"saveButton"`). @param locale Optional BCP-47 locale tag. When omitted the first locale from `getCmsConfig().locales` is used, falling back to `"en"`.

### Types & Interfaces

- `interface AstropressResolvedAdminUiConfig` — Resolve a localised admin UI label. Falls back through: `locale` → first site locale from config → `"en"`. Unknown keys return `key` so missing translations are visible rather than blank. @param key    The label key (e.g. `"saveButton"`). @param locale Optional BCP-47 locale tag. When omitted the first locale from `getCmsConfig().locales` is used, falling back to `"en"`.
- `type AdminLocale`
- `type AdminLabelKey`
- `type AstropressAdminNavKey` — Resolve a localised admin UI label. Falls back through: `locale` → first site locale from config → `"en"`. Unknown keys return `key` so missing translations are visible rather than blank. @param key    The label key (e.g. `"saveButton"`). @param locale Optional BCP-47 locale tag. When omitted the first locale from `getCmsConfig().locales` is used, falling back to `"en"`.

---

## `astropress (cache-purge)`

### Functions

#### `purgeCdnCache`
```ts
function purgeCdnCache(slug: string, config: CmsConfig)
```
Purges CDN cache for a specific content slug after it is published. Supports three purge strategies: 1. Generic webhook — POST `{ slug, purgedAt }` to `config.cdnPurgeWebhook` 2. Cloudflare Cache API — uses CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN env vars 3. Both can be active simultaneously (webhook fires after Cloudflare API call) Failures are non-fatal: errors are logged with `console.warn` but never thrown, so a CDN purge failure never blocks a content publish operation. @example ```ts await purgeCdnCache("my-post-slug", getCmsConfig()); ```

---

## `astropress/sqlite-bootstrap`

### Functions

#### `resolveAstropressSqliteSchemaPath`
```ts
function resolveAstropressSqliteSchemaPath()
```

#### `readAstropressSqliteSchemaSql`
```ts
function readAstropressSqliteSchemaSql()
```

#### `runAstropressMigrations`
```ts
function runAstropressMigrations(
  db: SqliteDatabaseLike,
  migrationsDir: string,
)
```
Run incremental SQL migrations from a directory against a live SQLite database. Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`, `0002_create_index.sql`). They are applied in lexicographic order. Applied migrations are recorded in `schema_migrations` so they are never re-run. @example ```ts import { runAstropressMigrations } from "astropress/sqlite-bootstrap"; runAstropressMigrations(db, "./migrations"); ```

#### `checkSchemaVersionAhead`
```ts
function checkSchemaVersionAhead(
  db: SqliteDatabaseLike,
  frameworkBaseline = ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE,
)
```
Checks whether the database `schema_migrations` table has more entries than the framework's known baseline. When a host app applies its own migrations (or a third-party plugin does), this function can detect that the DB schema is "ahead" of the framework. @returns An object with `isAhead`, `dbCount`, and `frameworkCount` — or `null` if the `schema_migrations` table does not exist. @example ```ts const result = checkSchemaVersionAhead(db); if (result?.isAhead) { console.warn( `Database has ${result.dbCount} migrations, framework knows ${result.frameworkCount}. ` + `Run \`astropress db migrate --dry-run\` to review.` ); } ```

#### `createAstropressSqliteSeedToolkit`
```ts
function createAstropressSqliteSeedToolkit<TableName extends string = (typeof defaultSeedImportTables)[number]>(
  options: AstropressSqliteSeedToolkitOptions<TableName>,
)
```
Checks whether the database `schema_migrations` table has more entries than the framework's known baseline. When a host app applies its own migrations (or a third-party plugin does), this function can detect that the DB schema is "ahead" of the framework. @returns An object with `isAhead`, `dbCount`, and `frameworkCount` — or `null` if the `schema_migrations` table does not exist. @example ```ts const result = checkSchemaVersionAhead(db); if (result?.isAhead) { console.warn( `Database has ${result.dbCount} migrations, framework knows ${result.frameworkCount}. ` + `Run \`astropress db migrate --dry-run\` to review.` ); } ```

#### `createDefaultAstropressSqliteSeedToolkit`
```ts
function createDefaultAstropressSqliteSeedToolkit()
```
Checks whether the database `schema_migrations` table has more entries than the framework's known baseline. When a host app applies its own migrations (or a third-party plugin does), this function can detect that the DB schema is "ahead" of the framework. @returns An object with `isAhead`, `dbCount`, and `frameworkCount` — or `null` if the `schema_migrations` table does not exist. @example ```ts const result = checkSchemaVersionAhead(db); if (result?.isAhead) { console.warn( `Database has ${result.dbCount} migrations, framework knows ${result.frameworkCount}. ` + `Run \`astropress db migrate --dry-run\` to review.` ); } ```

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
- `type AdminRole`

### Exported constants / re-exports

- `defaultSeedImportTables`
- `ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE` — The number of framework-owned migrations that Astropress applies during bootstrapping. This count is used by `checkSchemaVersionAhead` to detect when a database has host-app migrations that the framework itself is unaware of. Update this constant when new framework-owned migrations are added to `sqlite-bootstrap.ts`.

---

## `astropress/integration`

### Functions

#### `createAstropressSitemapIntegration`
```ts
function createAstropressSitemapIntegration(
  options: AstropressSitemapOptions = {},
)
```
createAstropressSitemapIntegration A thin Astro integration wrapper around the framework's built-in sitemap page (`/sitemap.xml`). It ensures the sitemap is injected with the correct canonical URL configuration. Use this when you prefer the named integration pattern (`integrations: [...]`) rather than calling `createAstropressPublicSiteIntegration()` which injects all public routes at once. @example ```ts // astro.config.mjs import { createAstropressSitemapIntegration } from "astropress"; export default defineConfig({ integrations: [ createAstropressSitemapIntegration({ siteUrl: "https://example.com" }), ], }); ```

### Types & Interfaces

- `interface AstropressPublicSiteOptions`
- `interface AstropressSitemapOptions` — Astro integration for the public production site. Unlike `createAstropressAdminAppIntegration`, this integration does NOT inject any `/ap-admin/*` routes or admin middleware. It is designed for use in a purely static Astro build so that the production domain has zero admin surface. @example ```ts // astro.config.mjs (public site project) import { createAstropressPublicSiteIntegration } from "astropress"; export default defineConfig({ integrations: [createAstropressPublicSiteIntegration()], }); ```

---
