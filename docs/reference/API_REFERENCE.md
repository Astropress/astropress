# Astropress API Reference

Auto-generated from TypeScript source via the TypeScript compiler API.
Run `bun run docs:api` to regenerate.

Generated: 2026-05-02

---

## `astropress`

### Functions

#### `createAstropressPublicSiteIntegration`
```ts
function createAstropressPublicSiteIntegration(options: AstropressPublicSiteOptions): AstroIntegration
```

#### `registerProvider`
```ts
function registerProvider<TFields>(domain: IntegrationDomain, definition: ProviderDefinition<TFields>): RegisteredProvider<TFields>
```

#### `getProvider`
```ts
function getProvider<TFields>(domain: IntegrationDomain, providerId: string): RegisteredProvider<TFields> | undefined
```

#### `listProviders`
```ts
function listProviders(domain: IntegrationDomain): readonly RegisteredProvider<Record<string, string>>[]
```

#### `connectIntegration`
```ts
function connectIntegration<TFields>(repo: IntegrationsRepository, params: ConnectIntegrationParams<TFields>): Promise<ConnectIntegrationResult>
```

#### `reverifyIntegration`
```ts
function reverifyIntegration<TFields>(repo: IntegrationsRepository, provider: RegisteredProvider<TFields>, fields: TFields, now: string, timeoutMs: number): Promise<ConnectIntegrationResult>
```

#### `runProviderVerify`
```ts
function runProviderVerify<TFields>(provider: RegisteredProvider<TFields>, fields: TFields, timeoutMs: number): Promise<{ ok: true; } | { ok: false; code: IntegrationErrorCode; }>
```

#### `getConnectedProvider`
```ts
function getConnectedProvider<TFields>(args: GetConnectedProviderArgs): Promise<ConnectedProvider<TFields> | undefined>
```

#### `createRequestProviderCache`
```ts
function createRequestProviderCache(args: GetConnectedProviderArgs): () => Promise<ConnectedProvider<Record<string, string>> | undefined>
```

#### `listRegisteredProvidersForDomain`
```ts
function listRegisteredProvidersForDomain(domain: IntegrationDomain): readonly { id: string; label: string; }[]
```

#### `registerListmonk`
```ts
function registerListmonk(): RegisteredProvider<{ baseUrl: string; apiUser: string; apiKey: string; }>
```

#### `verifyListmonk`
```ts
function verifyListmonk(fields: { baseUrl: string; apiUser: string; apiKey: string; }, ctx: { signal: AbortSignal; }, deps: ListmonkVerifyDeps): Promise<void>
```

#### `registerPlausible`
```ts
function registerPlausible(): RegisteredProvider<{ host: string; siteId: string; apiKey: string; }>
```

#### `verifyPlausible`
```ts
function verifyPlausible(fields: { host: string; siteId: string; apiKey: string; }, ctx: { signal: AbortSignal; }, deps: PlausibleVerifyDeps): Promise<void>
```

#### `registerCloudflareCdn`
```ts
function registerCloudflareCdn(): RegisteredProvider<{ apiToken: string; zoneId: string; }>
```

#### `verifyCloudflareCdn`
```ts
function verifyCloudflareCdn(fields: { apiToken: string; zoneId: string; }, ctx: { signal: AbortSignal; }, deps: CloudflareCdnVerifyDeps): Promise<void>
```

#### `classifyCloudflareStatus`
```ts
function classifyCloudflareStatus(res: Response): IntegrationErrorCode | null
```

#### `registerGithubDeploy`
```ts
function registerGithubDeploy(): RegisteredProvider<{ accessToken: string; }>
```

#### `verifyGithubDeploy`
```ts
function verifyGithubDeploy(fields: { accessToken: string; }, ctx: { signal: AbortSignal; }, deps: GithubDeployVerifyDeps): Promise<void>
```

#### `classifyGithubStatus`
```ts
function classifyGithubStatus(res: Response): IntegrationErrorCode | null
```

#### `issueOAuthState`
```ts
function issueOAuthState(args: IssueOAuthStateArgs): Promise<IssuedOAuthState>
```

#### `verifyOAuthState`
```ts
function verifyOAuthState(args: VerifyOAuthStateArgs): Promise<VerifyOAuthStateResult>
```

#### `verifyInboundWebhookSignature`
```ts
function verifyInboundWebhookSignature(args: VerifyInboundWebhookArgs): Promise<boolean>
```

#### `verifyGithubWebhookSignature`
```ts
function verifyGithubWebhookSignature(args: { readonly header: string; readonly body: Uint8Array<ArrayBufferLike>; readonly secret: string; }): Promise<boolean>
```

#### `createIntegrationsRepository`
```ts
function createIntegrationsRepository(options: IntegrationsRepositoryOptions): IntegrationsRepository
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

#### `getAdminLabel`
```ts
function getAdminLabel(key: AdminLabelKey, locale: string | undefined): string
```

#### `resolveAstropressAdminUiConfig`
```ts
function resolveAstropressAdminUiConfig(locale: AdminLocale | undefined): AstropressResolvedAdminUiConfig
```

#### `getAdminStubPage`
```ts
function getAdminStubPage(slug: string): AdminStubPageEntry | undefined
```

#### `actionMatches`
```ts
function actionMatches(pattern: string, requested: string): boolean
```

#### `createAccessMiddleware`
```ts
function createAccessMiddleware(): (ctx: MiddlewareInput, next: () => Promise<Response>) => Promise<Response>
```

#### `createAccessRepository`
```ts
function createAccessRepository(store: AccessStore): { listRoles(): RoleRecord[]; getRole(id: string): RoleRecord | undefined; createRole(input: { name: string; description?: string | undefined; }): RoleRecord; updateRole(id: string, input: { name?: string | undefined; description?: string | undefined; }): void; deleteRole(id: string): void; listRolePolicies(roleId: string): RolePolicyRecord[]; addRolePolicy(input: { roleId: string; effect: Effect; action: string; condition?: Condition | null | undefined; priority?: number | undefined; }): RolePolicyRecord; removeRolePolicy(id: string): void; listUserRoles(userId: number): UserRoleAssignment[]; assignRole(input: { userId: number; roleId: string; grantedBy?: string | undefined; }): void; revokeRole(input: { userId: number; roleId: string; }): void; listUserPolicies(userId: number): UserPolicyRecord[]; countUserDirectGrants(userId: number): number; addUserPolicy(input: { userId: number; effect: Effect; action: string; condition?: Condition | null | undefined; priority?: number | undefined; grantedBy?: string | undefined; }): UserPolicyRecord; removeUserPolicy(id: string): void; getUserAttributes(userId: number): Readonly<Record<string, AttributeValue>>; setUserAttribute(input: { userId: number; key: string; value: AttributeValue; }): void; deleteUserAttribute(input: { userId: number; key: string; }): void; resolvePoliciesForUser(userId: number): Policy[]; listUserRoleIds(userId: number): string[]; countActiveAdmins(): number; }
```

#### `createPolicyEngine`
```ts
function createPolicyEngine(options: JsonPolicyEngineOptions): PolicyEngine
```

#### `evaluate`
```ts
function evaluate(subject: Subject, action: string, policies: readonly Policy[], resource: Resource | undefined, env: Env | undefined): EvaluationResult
```

#### `evaluateCondition`
```ts
function evaluateCondition(c: Condition, ctx: BindingContext): boolean
```

#### `getAccessAction`
```ts
function getAccessAction(id: string): ActionDefinition | undefined
```

#### `getAccessContext`
```ts
function getAccessContext(astro: { locals: Locals; }): Promise<AccessContext | null>
```

#### `listAccessActions`
```ts
function listAccessActions(): readonly ActionDefinition[]
```

#### `registerAccessAction`
```ts
function registerAccessAction(def: ActionDefinition): void
```

#### `requiresAccess`
```ts
function requiresAccess(astro: AstroLike, action: string, options: RequiresAccessOptions): Promise<Response | null>
```

#### `resolvePath`
```ts
function resolvePath(path: string, ctx: BindingContext): AttributeValue | undefined
```

#### `seedStarterRoles`
```ts
function seedStarterRoles(repo: { listRoles(): RoleRecord[]; getRole(id: string): RoleRecord | undefined; createRole(input: { name: string; description?: string | undefined; }): RoleRecord; updateRole(id: string, input: { name?: string | undefined; description?: string | undefined; }): void; deleteRole(id: string): void; listRolePolicies(roleId: string): RolePolicyRecord[]; addRolePolicy(input: { roleId: string; effect: Effect; action: string; condition?: Condition | null | undefined; priority?: number | undefined; }): RolePolicyRecord; removeRolePolicy(id: string): void; listUserRoles(userId: number): UserRoleAssignment[]; assignRole(input: { userId: number; roleId: string; grantedBy?: string | undefined; }): void; revokeRole(input: { userId: number; roleId: string; }): void; listUserPolicies(userId: number): UserPolicyRecord[]; countUserDirectGrants(userId: number): number; addUserPolicy(input: { userId: number; effect: Effect; action: string; condition?: Condition | null | undefined; priority?: number | undefined; grantedBy?: string | undefined; }): UserPolicyRecord; removeUserPolicy(id: string): void; getUserAttributes(userId: number): Readonly<Record<string, AttributeValue>>; setUserAttribute(input: { userId: number; key: string; value: AttributeValue; }): void; deleteUserAttribute(input: { userId: number; key: string; }): void; resolvePoliciesForUser(userId: number): Policy[]; listUserRoleIds(userId: number): string[]; countActiveAdmins(): number; }): void
```

#### `substituteString`
```ts
function substituteString(src: string, ctx: BindingContext): string
```

#### `addRuntimeRolePolicy`
```ts
function addRuntimeRolePolicy(locals: Locals | null | undefined, input: { roleId: string; effect: Effect; action: string; condition?: Condition | null | undefined; priority?: number | undefined; }): Promise<ActionResult<RolePolicyRecord>>
```

#### `addRuntimeUserDirectGrant`
```ts
function addRuntimeUserDirectGrant(locals: Locals | null | undefined, input: DirectGrantInput): Promise<ActionResult<UserPolicyRecord>>
```

#### `assertNotLastActiveAdmin`
```ts
function assertNotLastActiveAdmin(locals: Locals | null | undefined, targetEmail: string): Promise<ActionResult<void>>
```

#### `assignRuntimeUserRole`
```ts
function assignRuntimeUserRole(locals: Locals | null | undefined, input: AssignRoleInput): Promise<ActionResult<{ userId: number; roleId: string; }>>
```

#### `createRuntimeRole`
```ts
function createRuntimeRole(locals: Locals | null | undefined, input: { name: string; description?: string | undefined; }): Promise<ActionResult<RoleRecord>>
```

#### `deleteRuntimeRole`
```ts
function deleteRuntimeRole(locals: Locals | null | undefined, input: { id: string; }): Promise<ActionResult<{ id: string; }>>
```

#### `removeRuntimeRolePolicy`
```ts
function removeRuntimeRolePolicy(locals: Locals | null | undefined, input: { policyId: string; }): Promise<ActionResult<{ id: string; }>>
```

#### `removeRuntimeUserDirectGrant`
```ts
function removeRuntimeUserDirectGrant(locals: Locals | null | undefined, input: { grantId: string; }): Promise<ActionResult<{ id: string; }>>
```

#### `revokeRuntimeUserRole`
```ts
function revokeRuntimeUserRole(locals: Locals | null | undefined, input: { userId: number; roleId: string; }): Promise<ActionResult<{ userId: number; roleId: string; }>>
```

#### `updateRuntimeRole`
```ts
function updateRuntimeRole(locals: Locals | null | undefined, input: { id: string; name?: string | undefined; description?: string | undefined; }): Promise<ActionResult<{ id: string; }>>
```

#### `buildAccessPageModel`
```ts
function buildAccessPageModel(locals: Locals, user: AuthUser | null | undefined, options: { tab?: AccessPageTab | undefined; }): Promise<AdminPageResult<AccessPageModel>>
```

#### `resolveAdminLocale`
```ts
function resolveAdminLocale(astro: AdminLocaleSource): AdminLocale
```

#### `pickAdminLocaleFromAcceptLanguage`
```ts
function pickAdminLocaleFromAcceptLanguage(header: string | null | undefined): AdminLocale | null
```

#### `getPageT`
```ts
function getPageT(locale: AdminLocale): (key: "common.search" | "common.title" | "common.status" | "common.actions" | "common.updated" | "common.path" | "common.author" | "common.category" | "common.allStatuses" | "common.allAuthors" | "common.allCategories" | "common.allTags" | "common.clearFilters" | "common.applyFilters" | "common.draft" | "common.published" | "common.archived" | "common.scheduled" | "common.inReview" | "common.unscheduled" | "common.kindPost" | "common.kindPage" | "common.kindRoutePage" | "common.statusReview" | "common.statusPending" | "common.needsReview" | "common.viewAll" | "common.openQueue" | "common.openEditor" | "banner.bootstrap.before" | "banner.bootstrap.link" | "banner.bootstrap.after" | "dashboard.description" | "dashboard.publishedPosts" | "dashboard.publishedPostsDesc" | "dashboard.publicPages" | "dashboard.publicPagesDesc" | "dashboard.needsReviewDesc" | "dashboard.scheduledPosts" | "dashboard.scheduledPostsDesc" | "dashboard.redirectRules" | "dashboard.redirectRulesDesc" | "dashboard.translationFollowup" | "dashboard.translationFollowupDesc" | "dashboard.create" | "dashboard.startNewWork" | "dashboard.startNewWorkDesc" | "dashboard.newPost" | "dashboard.newPage" | "dashboard.newAuthor" | "dashboard.newUser" | "dashboard.supportSurfaces" | "dashboard.supportSurfacesDesc" | "dashboard.translations" | "dashboard.translationsDesc" | "dashboard.seo" | "dashboard.seoDesc" | "dashboard.archives" | "dashboard.archivesDesc" | "dashboard.system" | "dashboard.systemDesc" | "dashboard.queue" | "dashboard.scheduledSoon" | "dashboard.scheduledSoonDesc" | "dashboard.viewScheduled" | "dashboard.noFutureScheduled" | "dashboard.postReviewQueue" | "dashboard.postReviewQueueDesc" | "dashboard.recentActivity" | "dashboard.recentlyUpdated" | "dashboard.recentlyUpdatedDesc" | "dashboard.publish" | "dashboard.latestDeployment" | "dashboard.latestDeploymentDesc" | "dashboard.noPublishYet" | "dashboard.descriptionEditor" | "dashboard.pendingComments" | "dashboard.pendingCommentsDesc" | "dashboard.editorialQueue" | "dashboard.open" | "dashboard.review" | "dashboard.nothingWaiting" | "dashboard.partialResults" | "dashboard.deployNoRecord" | "dashboard.deployTriggered" | "dashboard.deployFailed" | "dashboard.deployBy" | "common.unknownUpdateTime" | "posts.description" | "posts.partialResults" | "posts.openPublicBlog" | "posts.visiblePosts" | "posts.visiblePostsDesc" | "posts.reviewQueue" | "posts.reviewQueueDesc" | "posts.workflow" | "posts.blogPostList" | "posts.searchOnce" | "posts.searchPlaceholder" | "posts.searchPosts" | "posts.workflowFilter" | "posts.allWorkflowStates" | "posts.tag" | "posts.archiveFilter" | "posts.matchedSummary" | "posts.contentFilters" | "posts.contentList" | "posts.tableScheduled" | "posts.authors" | "posts.categories" | "posts.noMatched" | "posts.previous" | "posts.next" | "posts.previousPage" | "posts.nextPage" | "posts.pageOf" | "posts.pagination" | "pages.description" | "pages.partialResults" | "pages.openRouteTable" | "pages.allPages" | "pages.allPagesDesc" | "pages.structuredPages" | "pages.structuredPagesDesc" | "pages.publicPageOwnership" | "pages.pageIndex" | "pages.useThisIndex" | "pages.structuredExplanation" | "pages.pageTypesInList" | "pages.kindLegacy" | "pages.kindStructured" | "pages.kindArchive" | "pages.legacyExplanation" | "pages.structuredExplanation2" | "pages.archiveExplanation" | "pages.ofPagesSummary" | "pages.searchPages" | "pages.searchPlaceholder" | "pages.filterByKind" | "pages.filterByKindAria" | "pages.allKinds" | "pages.kind" | "pages.pagesList" | "pages.noMatch" | "pages.noMatchOr" | "pages.createNewPage" | "pages.editArchive" | "pages.editPageRow" | "pages.editRoutePage" | "pages.openPage" | "pages.seeded" | "pages.forbidden.description" | "pages.forbidden.body" | "media.description" | "media.partialResults" | "media.savedSuccess" | "media.deletedSuccess" | "media.totalAssets" | "media.totalAssetsDesc" | "media.missingAlt" | "media.missingAltDesc" | "media.addAssets" | "media.uploadMedia" | "media.uploadDesc" | "media.file" | "media.altText" | "media.uploadButton" | "media.uploading" | "media.browse" | "media.libraryGrid" | "media.libraryGridDesc" | "media.noAssets" | "media.metadata" | "media.libraryList" | "media.libraryListDesc" | "media.preview" | "media.titleAlt" | "media.localPath" | "media.r2Key" | "media.sourceUrl" | "media.noAlt" | "media.saveMetadata" | "media.delete" | "media.deleteDialogTitle" | "media.deleteDialogBody" | "media.deleteWarning" | "media.cancel" | "media.deleteAsset" | "media.assets" | "media.id" | "media.fileAria" | "media.titleAria" | "media.altAria" | "media.fileRequired" | "comments.description" | "comments.partialResults" | "comments.savedSuccess" | "comments.totalComments" | "comments.totalCommentsDesc" | "comments.pendingReview" | "comments.pendingReviewDesc" | "comments.moderation" | "comments.moderationQueue" | "comments.moderationQueueDesc" | "comments.queueAria" | "comments.author" | "comments.route" | "comments.policy" | "comments.action" | "comments.empty" | "comments.approve" | "comments.reject" | "comments.rejectDialogTitle" | "comments.rejectDialogBody" | "comments.cancel" | "comments.statusPending" | "comments.statusApproved" | "comments.statusRejected" | "comments.policyOpenModerated" | "redirects.description" | "redirects.partialResults" | "redirects.addRule" | "redirects.create" | "redirects.newRule" | "redirects.newRuleDesc" | "redirects.legacyPath" | "redirects.targetPath" | "redirects.statusCode" | "redirects.saveRule" | "redirects.inventory" | "redirects.reviewedRules" | "redirects.reviewedRulesDesc" | "redirects.legacy" | "redirects.target" | "redirects.delete" | "redirects.copy" | "redirects.empty" | "redirects.deleteDialogTitle" | "redirects.deleteDialogBody" | "redirects.deleteWarning" | "redirects.cancel" | "redirects.deleteRule" | "redirects.savedSuccess" | "redirects.deletedSuccess" | "redirects.tableAria" | "audit.recentTrail" | "audit.empty" | "audit.mediaAudit" | "authors.title" | "authors.description" | "authors.partialResults" | "authors.savedSuccess" | "authors.deletedSuccess" | "authors.deletedToast" | "authors.undo" | "authors.newAuthor" | "authors.newAuthorDesc" | "authors.authorName" | "authors.slug" | "authors.authorSlug" | "authors.bio" | "authors.authorBio" | "authors.bioPlaceholder" | "authors.saveAuthor" | "authors.listDesc" | "authors.tableAria" | "authors.thName" | "authors.thSlug" | "authors.thBio" | "authors.edit" | "authors.update" | "authors.delete" | "authors.ariaName" | "authors.ariaSlug" | "authors.ariaBio" | "authors.deleteDialogTitle" | "authors.deleteConfirmPrefix" | "authors.deleteConfirmSuffix" | "authors.deleteWarning" | "authors.cancel" | "authors.deleteAuthor" | "authors.forbiddenTitle" | "taxonomies.title" | "taxonomies.description" | "taxonomies.partialResults" | "taxonomies.savedSuccess" | "taxonomies.deletedSuccess" | "taxonomies.deletedToast" | "taxonomies.undo" | "taxonomies.categories" | "taxonomies.categoriesDesc" | "taxonomies.categoryName" | "taxonomies.categorySlug" | "taxonomies.categoryDescription" | "taxonomies.saveCategory" | "taxonomies.tags" | "taxonomies.tagsDesc" | "taxonomies.tagName" | "taxonomies.tagSlug" | "taxonomies.tagDescription" | "taxonomies.saveTag" | "taxonomies.slug" | "taxonomies.descriptionField" | "taxonomies.thName" | "taxonomies.thSlug" | "taxonomies.edit" | "taxonomies.update" | "taxonomies.delete" | "taxonomies.cancel" | "taxonomies.deleteWarning" | "taxonomies.deleteConfirmPrefix" | "taxonomies.deleteConfirmSuffix" | "taxonomies.deleteCategoryDialogTitle" | "taxonomies.deleteCategory" | "taxonomies.deleteTagDialogTitle" | "taxonomies.deleteTag" | "taxonomies.forbiddenTitle" | "layout.skipToContent" | "layout.openNavigation" | "layout.closeNavigation" | "layout.toggleUtilityPanel" | "layout.keyboardShortcuts" | "layout.scrollToBottom" | "layout.scrollToTop" | "layout.adminSections" | "layout.recent" | "layout.commandPalette" | "layout.commandPaletteResults" | "layout.searchAdminPages" | "layout.shortcutSaveDraft" | "layout.shortcutPublish" | "layout.shortcutEscape" | "layout.shortcutTab" | "layout.shortcutShiftTab" | "layout.shortcutHelp" | "layout.shortcutCmd" | "layout.goTo" | "settings.title" | "settings.description" | "settings.partialLoadNotice" | "settings.savedNotice" | "settings.tabsLabel" | "settings.tabGeneral" | "settings.tabNewsletter" | "settings.tabImport" | "settings.donationDestination" | "settings.donationDestinationDesc" | "settings.newsletterState" | "settings.newsletterStateDesc" | "settings.on" | "settings.off" | "settings.brandKicker" | "settings.siteIdentity" | "settings.siteIdentityDesc" | "settings.siteTitle" | "settings.siteTagline" | "settings.engagementKicker" | "settings.newsletter" | "settings.newsletterDesc" | "settings.enableNewsletter" | "settings.fundraisingKicker" | "settings.donationSettings" | "settings.donationUrl" | "settings.moderationKicker" | "settings.commentSettings" | "settings.defaultCommentPolicy" | "settings.commentDisabled" | "settings.commentLegacy" | "settings.commentOpenModerated" | "settings.saveButton" | "settings.subscriberRemoved" | "settings.importComplete" | "settings.subscribersKicker" | "settings.newsletterSubscribers" | "settings.subscribersDescBefore" | "settings.subscribersDescAfter" | "settings.listmonkRequiresEnv" | "settings.searchSubscribers" | "settings.searchSubscribersPlaceholder" | "settings.searchButton" | "settings.clearButton" | "settings.noSubscribersFound" | "settings.subscriberCountSingular" | "settings.subscriberCountPlural" | "settings.matching" | "settings.colEmail" | "settings.colName" | "settings.colSubscribed" | "settings.viewAction" | "settings.subscriberPagesLabel" | "settings.previous" | "settings.next" | "settings.pageInfo" | "settings.migrationKicker" | "settings.importMailchimp" | "settings.importMailchimpDescBefore" | "settings.importMailchimpDescOptional" | "settings.mailchimpFile" | "settings.mailchimpFileAria" | "settings.importSubscribersBtn" | "settings.uploading" | "settings.importingAria" | "settings.contentMigrationKicker" | "settings.importContent" | "settings.importContentDesc" | "settings.wordpress" | "settings.wordpressDesc" | "settings.setupWordpressImport" | "settings.wix" | "settings.wixDesc" | "settings.setupWixImport" | "settings.webCrawl" | "settings.webCrawlDesc" | "settings.setupCrawlImport" | "settings.importNoteBefore" | "settings.importNoteAfter" | "settings.subErrorLoadingList" | "users.title" | "users.description" | "users.partialNotice" | "users.invitationIssued" | "users.userCreatedNoEmail" | "users.userSuspended" | "users.userRestored" | "users.invitationLink" | "users.resetLinkPrefix" | "users.intro" | "users.totalUsers" | "users.totalUsersDesc" | "users.pendingInvites" | "users.pendingInvitesDesc" | "users.accessControlKicker" | "users.currentUsers" | "users.currentUsersDesc" | "users.adminUsersAria" | "users.colName" | "users.colEmail" | "users.colRole" | "users.colJoined" | "users.statusSuspended" | "users.statusInvited" | "users.statusActive" | "users.unsuspend" | "users.suspend" | "users.resetLinkBtn" | "users.createAccessKicker" | "users.inviteUser" | "users.inviteUserDesc" | "users.fullName" | "users.email" | "users.role" | "users.roleEditor" | "users.roleAdmin" | "users.sendInvitation" | "users.inviteNote" | "users.userAndAccessAudit" | "users.gdprKicker" | "users.purgeUserData" | "users.purgeUserDataDesc" | "users.purgeEmailLabel" | "users.purgeDeleteCheckbox" | "users.purgeAndDownload" | "users.confirmSuspendTitle" | "users.confirmSuspendBefore" | "users.confirmSuspendAfter" | "users.confirmSuspendNote" | "users.cancel" | "users.suspendUserBtn" | "users.confirmPurgeTitle" | "users.confirmPurgeDesc" | "users.confirmPurgeWarning" | "users.purgeAndDownloadShort" | "routePages.title" | "routePages.description" | "routePages.partialResults" | "routePages.securityKicker" | "routePages.adminUrlHeading" | "routePages.adminUrlIntroPrefix" | "routePages.adminUrlIntroSuffix" | "routePages.defaultSlugWarningStrong" | "routePages.defaultSlugWarningRest" | "routePages.slugSavedPrefix" | "routePages.adminUrlPrefixLabel" | "routePages.slugInputTitle" | "routePages.slugFieldNote" | "routePages.slugFieldNoteOr" | "routePages.saveAdminUrl" | "routePages.technicalInventory" | "routePages.structuredRouteInventory" | "routePages.structuredRouteDesc" | "routePages.backToPages" | "routePages.tableAria" | "routePages.template" | "routePages.ownerEditor" | "routePages.publicView" | "routePages.pages" | "routePages.openRoute" | "routePages.seeded" | "routePages.forbiddenTitle" | "routePages.forbiddenDesc" | "routePages.forbiddenBody" | "routePageEditor.title" | "routePageEditor.titlePrefix" | "routePageEditor.description" | "routePageEditor.breadcrumb" | "routePageEditor.routePagesLink" | "routePageEditor.partialResults" | "routePageEditor.openPublicPage" | "routePageEditor.openRouteTable" | "routePageEditor.savedSuccess" | "routePageEditor.general" | "routePageEditor.generalDesc" | "routePageEditor.publicRoute" | "routePageEditor.templateLabel" | "routePageEditor.titleField" | "routePageEditor.titleFieldAria" | "routePageEditor.summary" | "routePageEditor.summaryAria" | "routePageEditor.canonicalUrl" | "routePageEditor.robots" | "routePageEditor.robotsAria" | "routePageEditor.ogImage" | "routePageEditor.ogImageAria" | "routePageEditor.ownerLocale" | "routePageEditor.ownerLocaleDesc" | "routePageEditor.belongsToPagesWorkflow" | "routePageEditor.openPagesIndex" | "routePageEditor.openPublicRoute" | "routePageEditor.editEnglishOwner" | "routePageEditor.editEnglishVariant" | "routePageEditor.editSpanishVariant" | "routePageEditor.translationState" | "routePageEditor.stateNotStarted" | "routePageEditor.statePartial" | "routePageEditor.stateFallbackEn" | "routePageEditor.stateTranslated" | "routePageEditor.stateReviewed" | "routePageEditor.statePublished" | "routePageEditor.updateTranslationState" | "routePageEditor.seoHeading" | "routePageEditor.seoDesc" | "routePageEditor.seoTitle" | "routePageEditor.seoTitleAria" | "routePageEditor.metaDescription" | "routePageEditor.metaDescriptionAria" | "routePageEditor.alternateLinks" | "routePageEditor.alternateLinksDesc" | "routePageEditor.alternateLinksJsonAria" | "routePageEditor.sectionsJson" | "routePageEditor.sectionsJsonDesc" | "routePageEditor.sectionsJsonNote" | "routePageEditor.sectionsJsonAria" | "routePageEditor.revisionNote" | "routePageEditor.revisionNoteDesc" | "routePageEditor.revisionNoteAria" | "routePageEditor.revisionNotePlaceholder" | "routePageEditor.saveRoutePage" | "routePageEditor.backToRouteTable" | "routePageEditor.notFoundTitle" | "routePageEditor.notFoundDesc" | "archives.title" | "archives.description" | "archives.partialResults" | "archives.backToPages" | "archives.managePosts" | "archives.totalArchives" | "archives.totalListingItems" | "archives.archivesByKind" | "archives.archivesByKindDesc" | "archives.allArchives" | "archives.allArchivesDesc" | "archives.kind" | "archives.slug" | "archives.items" | "archives.editArchive" | "archives.openArchive" | "archives.noteStrong" | "archives.noteBody" | "archives.forbiddenTitle" | "archives.forbiddenDesc" | "archives.forbiddenBody" | "archiveEditor.title" | "archiveEditor.description" | "archiveEditor.breadcrumb" | "archiveEditor.archivesLink" | "archiveEditor.partialResults" | "archiveEditor.backToArchives" | "archiveEditor.openPublicArchive" | "archiveEditor.manageInPosts" | "archiveEditor.savedSuccess" | "archiveEditor.metadataHeading" | "archiveEditor.publicArchiveRoute" | "archiveEditor.titleField" | "archiveEditor.summary" | "archiveEditor.seoTitle" | "archiveEditor.metaDescription" | "archiveEditor.canonicalUrlOverride" | "archiveEditor.robotsDirective" | "archiveEditor.revisionNote" | "archiveEditor.revisionNotePlaceholder" | "archiveEditor.saveArchive" | "archiveEditor.cancel" | "archiveEditor.notFoundTitle" | "archiveEditor.notFoundDesc" | "archiveEditor.forbiddenTitle" | "archiveEditor.forbiddenDesc" | "archiveEditor.forbiddenBody" | "translations.title" | "translations.description" | "translations.partialResults" | "translations.savedSuccess" | "translations.localizedRoutes" | "translations.localizedRoutesDesc" | "translations.publishedTranslations" | "translations.publishedTranslationsDesc" | "translations.coverageKicker" | "translations.coverageHeading" | "translations.coverageDesc" | "translations.filterAria" | "translations.allStates" | "translations.applyFilter" | "translations.summaryOf" | "translations.summaryRoutes" | "translations.tableAria" | "translations.route" | "translations.locale" | "translations.englishSource" | "translations.edit" | "translations.update" | "translations.editEn" | "translations.editLocale" | "translations.translationStateForRoute" | "translations.saveState" | "translations.forbiddenTitle" | "translations.forbiddenDesc" | "translations.forbiddenBody" | "seo.title" | "seo.description" | "seo.partialResults" | "seo.indexedRecords" | "seo.indexedRecordsDesc" | "seo.needsMetadata" | "seo.needsMetadataDesc" | "seo.triageKicker" | "seo.triageHeading" | "seo.triageDesc" | "seo.sortRowsAria" | "seo.sortByPath" | "seo.sortByTitle" | "seo.sortByType" | "seo.sortByStatus" | "seo.apply" | "seo.ofIndexed" | "seo.indexedItems" | "seo.filterAll" | "seo.filterPages" | "seo.filterPosts" | "seo.filterStructured" | "seo.filterArchives" | "seo.filterSystem" | "seo.missingOnly" | "seo.overview" | "seo.tableAria" | "seo.colType" | "seo.colSeoTitle" | "seo.colMetaDescription" | "seo.colEdit" | "seo.needsWork" | "seo.ready" | "seo.edit" | "system.title" | "system.description" | "system.partialResults" | "system.backToPages" | "system.open500" | "system.openRobots" | "system.openSitemap" | "system.savedSuccess" | "system.errorSurfaceKicker" | "system.errorPageHeading" | "system.errorPageDesc" | "system.publicRoute" | "system.generatedPublicOutput" | "system.fieldTitle" | "system.fieldSummary" | "system.fieldBody" | "system.fieldButtonLabel" | "system.fieldButtonHref" | "system.fieldContactHref" | "system.fieldRevisionNote" | "system.revisionPlaceholder" | "system.errorPageDefaultTitle" | "system.errorPageDefaultButton" | "system.save500" | "system.crawlerOutputKicker" | "system.robotsHeading" | "system.robotsDesc" | "system.saveRobots" | "system.robotsDefaultTitle" | "system.generatedSitemapKicker" | "system.sitemapHeading" | "system.sitemapDesc" | "system.fieldExcludedPaths" | "system.fieldExtraUrls" | "system.saveSitemap" | "system.sitemapDefaultTitle" | "system.forbiddenBody" | "apiTokens.title" | "apiTokens.description" | "apiTokens.revokedSuccess" | "apiTokens.created" | "apiTokens.copyNow" | "apiTokens.createKicker" | "apiTokens.newToken" | "apiTokens.label" | "apiTokens.labelPlaceholder" | "apiTokens.scopes" | "apiTokens.createButton" | "apiTokens.existingTokens" | "apiTokens.noTokens" | "apiTokens.colCreated" | "apiTokens.colLastUsed" | "apiTokens.never" | "apiTokens.revoked" | "apiTokens.active" | "apiTokens.revoke" | "apiTokens.confirmTitle" | "apiTokens.confirmBody" | "apiTokens.confirmWarning" | "apiTokens.cancel" | "apiTokens.revokeButton" | "webhooks.title" | "webhooks.description" | "webhooks.deletedSuccess" | "webhooks.created" | "webhooks.copyBundle" | "webhooks.useToVerify" | "webhooks.headerSuffix" | "webhooks.registerKicker" | "webhooks.newWebhook" | "webhooks.endpointUrl" | "webhooks.events" | "webhooks.registerButton" | "webhooks.activeWebhooks" | "webhooks.noWebhooks" | "webhooks.colUrl" | "webhooks.colCreated" | "webhooks.colLastFired" | "webhooks.never" | "webhooks.delete" | "webhooks.confirmTitle" | "webhooks.confirmBody" | "webhooks.confirmWarning" | "webhooks.cancel" | "webhooks.deleteButton" | "services.title" | "services.description" | "services.emptyKicker" | "services.emptyHeading" | "services.emptyIntro" | "services.cmsDescription" | "services.shopDescription" | "services.communityDescription" | "services.emailDescription" | "services.viewDocs" | "services.setupNoteBefore" | "services.setupNoteMiddle" | "services.setupNoteAfter" | "services.seeDocsBefore" | "services.seeDocsLink" | "services.seeDocsAfter" | "services.openAdmin" | "services.notConfiguredTitle" | "services.notConfiguredDescription" | "services.notFound" | "services.notRegisteredBefore" | "services.notRegisteredAfter" | "services.notRegisteredEnd" | "services.backToServices" | "services.allServices" | "services.openInNewTab" | "services.adminFrameTitle" | "fundraising.title" | "fundraising.description" | "fundraising.kicker" | "fundraising.intro" | "fundraising.donatePageLink" | "fundraising.giveLivelyDescription" | "fundraising.liberapayDescription" | "fundraising.pledgeCryptoDescription" | "fundraising.configured" | "fundraising.needsConfig" | "fundraising.viewDonatePage" | "testimonials.title" | "testimonials.description" | "testimonials.partialResults" | "testimonials.savedSuccess" | "testimonials.totalSubmitted" | "testimonials.totalSubmittedDesc" | "testimonials.pendingReview" | "testimonials.pendingReviewDesc" | "testimonials.moderationKicker" | "testimonials.queueHeading" | "testimonials.tabsLabel" | "testimonials.tabPending" | "testimonials.tabApproved" | "testimonials.tabFeatured" | "testimonials.emptyPending" | "testimonials.emptyApproved" | "testimonials.emptyFeatured" | "testimonials.tableLabelPending" | "testimonials.tableLabelApproved" | "testimonials.tableLabelFeatured" | "testimonials.colName" | "testimonials.colCompany" | "testimonials.colRole" | "testimonials.colSpecificResult" | "testimonials.colConsent" | "testimonials.colSource" | "testimonials.colSubmitted" | "testimonials.colAction" | "testimonials.consentYes" | "testimonials.consentNo" | "testimonials.approve" | "testimonials.reject" | "testimonials.feature" | "testimonials.unfeature" | "footer.reportIssue" | "footer.docs" | "access.title" | "access.description" | "access.tabUsers" | "access.tabRoles" | "access.tabMyPermissions" | "access.usersHeading" | "access.usersDescription" | "access.usersColumnUser" | "access.usersColumnRoles" | "access.usersColumnDirectGrants" | "access.usersColumnAdmin" | "access.usersIsAdminBadge" | "access.usersDirectGrantsBadge" | "access.lastAdminWarning" | "access.assignRoleSubmit" | "access.revokeRoleSubmit" | "access.directGrantsHeading" | "access.directGrantsDescription" | "access.directGrantActionLabel" | "access.directGrantEffectLabel" | "access.directGrantAllow" | "access.directGrantDeny" | "access.directGrantAddSubmit" | "access.directGrantRemoveSubmit" | "access.rolesHeading" | "access.rolesDescription" | "access.rolesCreateHeading" | "access.rolesNameLabel" | "access.rolesDescriptionLabel" | "access.rolesCreateSubmit" | "access.rolesUpdateSubmit" | "access.rolesDeleteSubmit" | "access.rolesSystemBadge" | "access.rolesPolicyHeading" | "access.rolesPolicyEmpty" | "access.rolesPolicyAddHeading" | "access.rolesPolicyPriorityLabel" | "access.rolesPolicyAddSubmit" | "access.rolesPolicyRemoveSubmit" | "access.myPermissionsHeading" | "access.myPermissionsDescription" | "access.myPermissionsEmpty" | "access.myPermissionsActionColumn" | "access.myPermissionsEffectColumn" | "access.myPermissionsSourceColumn" | "access.myPermissionsConditionColumn" | "access.myPermissionsSourceDirect" | "access.myPermissionsSourceRole" | "pagesNew.title" | "pagesNew.heading" | "pagesNew.description" | "pagesNew.generalHeading" | "pagesNew.generalDesc" | "pagesNew.titleField" | "pagesNew.titleAria" | "pagesNew.publicPath" | "pagesNew.publicPathAria" | "pagesNew.summaryField" | "pagesNew.summaryAria" | "pagesNew.seoHeading" | "pagesNew.seoDescOptional" | "pagesNew.seoTitleField" | "pagesNew.seoTitleAria" | "pagesNew.metaDescriptionField" | "pagesNew.metaDescriptionAria" | "pagesNew.optionalHint" | "pagesNew.createPage" | "pagesNew.cancel" | "pagesNew.forbiddenTitle" | "pagesNew.forbiddenHeading" | "pagesNew.forbiddenDesc" | "pagesNew.forbiddenBody" | "routePageEditor.sectionsHeading" | "routePageEditor.sectionsHeadingDesc" | "routePageEditor.addSection" | "routePageEditor.addSectionDialogTitle" | "routePageEditor.startFromTemplate" | "routePageEditor.orPickSectionType" | "routePageEditor.dialogClose") => string
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

#### `isAuthUserAdmin`
```ts
function isAuthUserAdmin(user: AuthUser): boolean
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

#### `getAstropressRootSecret`
```ts
function getAstropressRootSecret(locals: Locals | null | undefined): string
```

#### `getAstropressRootSecretCandidates`
```ts
function getAstropressRootSecretCandidates(locals: Locals | null | undefined): string[]
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

#### `isTrustedStrictRequestOrigin`
```ts
function isTrustedStrictRequestOrigin(request: Request): boolean
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
function listRuntimeStructuredPageRoutes(locals: Locals | null | undefined): Promise<RuntimeStructuredPageRouteRecord[] | ({ path: string; title: string; summary: string | undefined; seoTitle: string | undefined; metaDescription: string | undefined; canonicalUrlOverride: string | undefined; robotsDirective: string | undefined; ogImage: string | undefined; templateKey: string; alternateLinks: { hreflang: string; href: string; }[]; sections: Record<string, unknown> | null; updatedAt: string; } | null)[]>
```

#### `listRuntimeSystemRoutes`
```ts
function listRuntimeSystemRoutes(locals: Locals | null | undefined): Promise<(RuntimeSystemRouteRecord | null)[]>
```

#### `saveRuntimeArchiveRoute`
```ts
function saveRuntimeArchiveRoute(pathname: string, input: { title: string; summary?: string | undefined; seoTitle?: string | undefined; metaDescription?: string | undefined; canonicalUrlOverride?: string | undefined; robotsDirective?: string | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeArchiveRouteRecord; } | { readonly ok: false; readonly error: "A title is required."; title?: undefined; summary?: undefined; seoTitle?: undefined; metaDescription?: undefined; canonicalUrlOverride?: undefined; robotsDirective?: undefined; } | { ok: true; route: { path: string; title: string; summary: string | undefined; seoTitle: string; metaDescription: string; canonicalUrlOverride: string | undefined; robotsDirective: string | undefined; }; } | { ok: false; error: string; }>
```

#### `saveRuntimeSystemRoute`
```ts
function saveRuntimeSystemRoute(pathname: string, input: { title: string; summary?: string | undefined; bodyHtml?: string | undefined; settings?: Record<string, unknown> | null | undefined; revisionNote?: string | undefined; }, actor: Actor, locals: Locals | null | undefined): Promise<{ ok: true; route: RuntimeSystemRouteRecord; } | { readonly ok: false; readonly error: "A title is required."; title?: undefined; summary?: undefined; bodyHtml?: undefined; settingsJson?: undefined; } | { ok: true; route: { path: string; title: string; summary: string | undefined; bodyHtml: string | undefined; settings: Record<string, unknown> | null; renderStrategy: "structured_sections" | "generated_text" | "generated_xml"; }; } | { ok: false; error: string; }>
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
function saveRuntimeContentState(slug: string, input: SaveContentInput, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
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
function createRuntimeMediaAsset(input: MediaAssetInput, actor: Actor, locals: Locals | null | undefined): Promise<unknown>
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
function buildAdminDashboardModel(locals: Locals, user: AuthUser | null | undefined, translationStatus: TranslationEntry[], deps: DashboardDeps): Promise<AdminDashboardModel>
```

#### `buildAdminDashboardPageModel`
```ts
function buildAdminDashboardPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<AdminDashboardModel>>
```

#### `buildPagesIndexPageModel`
```ts
function buildPagesIndexPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ contentStates: ContentRecord[]; routePages: RuntimeStructuredPageRouteRecord[] | ({ path: string; title: string; summary: string | undefined; seoTitle: string | undefined; metaDescription: string | undefined; canonicalUrlOverride: string | undefined; robotsDirective: string | undefined; ogImage: string | undefined; templateKey: string; alternateLinks: { hreflang: string; href: string; }[]; sections: Record<string, unknown> | null; updatedAt: string; } | null)[]; archiveRows: unknown[]; }>>
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
function buildRouteTablePageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ routePages: RuntimeStructuredPageRouteRecord[] | ({ path: string; title: string; summary: string | undefined; seoTitle: string | undefined; metaDescription: string | undefined; canonicalUrlOverride: string | undefined; robotsDirective: string | undefined; ogImage: string | undefined; templateKey: string; alternateLinks: { hreflang: string; href: string; }[]; sections: Record<string, unknown> | null; updatedAt: string; } | null)[]; settings: SiteSettings; }>>
```

#### `buildRoutePageEditorModel`
```ts
function buildRoutePageEditorModel(locals: Locals, routePath: string, user: AuthUser | null | undefined): Promise<AdminPageResult<{ pageRecord: RuntimeStructuredPageRouteRecord | null; englishOwner: ContentRecord | null; effectiveTranslationState: string | undefined; }>>
```

#### `buildArchivesIndexPageModel`
```ts
function buildArchivesIndexPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ archiveList: unknown[]; archivesByKind: Record<string, unknown[]>; kindCounts: { kind: string; count: number; }[]; totalArchives: number; totalItems: number; }>>
```

#### `buildArchiveEditorModel`
```ts
function buildArchiveEditorModel(locals: Locals, archivePath: string, user: AuthUser | null | undefined): Promise<AdminPageResult<{ archive: null; }> | AdminPageResult<{ archive: RuntimeArchiveRouteRecord; }>>
```

#### `buildSeoPageModel`
```ts
function buildSeoPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ rows: unknown[]; }>>
```

#### `buildMediaPageModel`
```ts
function buildMediaPageModel(locals: Locals): Promise<AdminPageResult<{ mediaWithResolvedUrls: { resolvedUrl: string; id: string; sourceUrl: string | null; localPath: string; r2Key: string | null; mimeType: string | null; width: number | null; height: number | null; fileSize: number | null; altText: string; title: string; uploadedAt: string; uploadedBy: string; thumbnailUrl?: string | null | undefined; srcset?: string | null | undefined; }[]; auditEvents: AuditEvent[]; }>>
```

#### `buildRedirectsPageModel`
```ts
function buildRedirectsPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ redirectRules: RedirectRule[]; auditEvents: AuditEvent[]; }>>
```

#### `buildAuthorsPageModel`
```ts
function buildAuthorsPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ authors: AuthorRecord[]; auditEvents: AuditEvent[]; }>>
```

#### `buildTaxonomiesPageModel`
```ts
function buildTaxonomiesPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ categories: TaxonomyTerm[]; tags: TaxonomyTerm[]; auditEvents: AuditEvent[]; }>>
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
function buildTranslationsPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ rows: unknown[]; }>>
```

#### `buildSettingsPageModel`
```ts
function buildSettingsPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ settings: SiteSettings; }>>
```

#### `buildSystemPageModel`
```ts
function buildSystemPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ systemRoutes: never[]; routeMap: Map<string, unknown>; }>>
```

#### `buildUsersPageModel`
```ts
function buildUsersPageModel(locals: Locals, user: AuthUser | null | undefined): Promise<AdminPageResult<{ users: ManagedAdminUser[]; auditEvents: AuditEvent[]; }>>
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
function readLocalImageAsset(publicPath: string): { ok: false; error: string; asset?: undefined; } | { ok: true; asset: { diskPath: string; bytes: ArrayBuffer; mimeType: string; }; readonly error?: undefined; }
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

#### `connectIntegrationAction`
```ts
function connectIntegrationAction<TFields>(locals: Locals | null | undefined, input: ConnectIntegrationActionInput<TFields>): Promise<RuntimeIntegrationActionResult>
```

#### `reverifyIntegrationAction`
```ts
function reverifyIntegrationAction<TFields>(locals: Locals | null | undefined, domain: IntegrationDomain, providerId: string, fields: TFields): Promise<RuntimeIntegrationActionResult>
```

#### `disconnectIntegrationAction`
```ts
function disconnectIntegrationAction(locals: Locals | null | undefined, domain: IntegrationDomain, providerId: string): Promise<{ ok: true; } | { ok: false; code: "INTEGRATIONS_NOT_AVAILABLE"; }>
```

#### `registerOAuthProvider`
```ts
function registerOAuthProvider(def: OAuthProviderDefinition): OAuthProviderDefinition
```

#### `getOAuthProvider`
```ts
function getOAuthProvider(domain: IntegrationDomain, providerId: string): OAuthProviderDefinition | undefined
```

#### `listOAuthProviders`
```ts
function listOAuthProviders(domain: IntegrationDomain): readonly OAuthProviderDefinition[]
```

#### `buildAuthorizeRedirect`
```ts
function buildAuthorizeRedirect(args: BuildAuthorizeRedirectArgs): Promise<BuildAuthorizeRedirectResult>
```

#### `buildRedirectUri`
```ts
function buildRedirectUri(origin: string, redirectPath: string): string
```

#### `exchangeCodeForToken`
```ts
function exchangeCodeForToken(args: ExchangeCodeForTokenArgs): Promise<OAuthTokenExchangeResult>
```

#### `registerInboundWebhookProvider`
```ts
function registerInboundWebhookProvider(def: InboundWebhookProviderDefinition): InboundWebhookProviderDefinition
```

#### `getInboundWebhookProvider`
```ts
function getInboundWebhookProvider(providerId: string): InboundWebhookProviderDefinition | undefined
```

#### `listInboundWebhookProviders`
```ts
function listInboundWebhookProviders(): readonly InboundWebhookProviderDefinition[]
```

#### `receiveInboundWebhook`
```ts
function receiveInboundWebhook(args: InboundWebhookReceiveArgs): Promise<InboundWebhookReceiveResult>
```

#### `integrationStatusBadgeTone`
```ts
function integrationStatusBadgeTone(status: IntegrationStatusBadgeKind): IntegrationStatusBadgeTone
```

#### `integrationStatusBadgeText`
```ts
function integrationStatusBadgeText(status: IntegrationStatusBadgeKind, labels: IntegrationStatusBadgeLabels): string
```

### Types & Interfaces

- `interface AstropressPublicSiteOptions`
- `type IntegrationDomain`
- `interface ProviderDefinition`
- `interface RegisteredProvider`
- `interface ConnectIntegrationParams`
- `type ConnectIntegrationResult`
- `interface ConnectedProvider`
- `type ListmonkFields`
- `type PlausibleFields`
- `type CloudflareCdnFields`
- `type GithubDeployFields`
- `interface OAuthStateContext`
- `interface IssuedOAuthState`
- `type VerifyOAuthStateResult`
- `type VerifyOAuthStateErrorCode`
- `interface IssueOAuthStateArgs`
- `interface VerifyOAuthStateArgs`
- `type InboundWebhookAlgorithm`
- `interface VerifyInboundWebhookArgs`
- `interface IntegrationsRepository`
- `interface IntegrationStatusRow`
- `type IntegrationStatusValue`
- `interface ConnectIntegrationInput`
- `interface AstropressPlugin`
- `interface AstropressContentEvent`
- `interface AstropressMediaEvent`
- `interface FieldDefinition`
- `interface ContentTypeDefinition`
- `interface CmsConfig`
- `interface TestimonialsConfig`
- `type AdminStubKey`
- `interface AdminStubPageEntry`
- `type AdminStubPageSlug`
- `interface StubEntry`
- `interface StubProvider`
- `interface AccessPageModel`
- `type AccessPageTab`
- `interface AccessContext`
- `type AccessRepository`
- `interface AccessSnapshot`
- `interface AccessStore`
- `interface ActionDefinition`
- `type AccessAttributeValue`
- `interface BindingContext`
- `type Condition`
- `type Decision`
- `type Effect`
- `interface AccessEnv`
- `interface EvaluationResult`
- `interface JsonPolicyEngineOptions`
- `interface LocalAccessStoreSurface`
- `interface Policy`
- `interface PolicyEngine`
- `type PolicyLoader`
- `interface PolicySource`
- `interface RequiresAccessOptions`
- `interface AccessResource`
- `interface RolePolicyRecord`
- `interface RoleRecord`
- `interface AccessSubject`
- `interface UserPolicyRecord`
- `interface UserRoleAssignment`
- `type AstropressAdminNavKey`
- `interface AstropressResolvedAdminUiConfig`
- `type AdminLocale`
- `type PageLabelKey`
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
- `interface ConnectIntegrationActionInput`
- `type RuntimeIntegrationActionResult`
- `interface OAuthProviderDefinition`
- `interface BuildAuthorizeRedirectArgs`
- `interface BuildAuthorizeRedirectResult`
- `interface OAuthTokenSet`
- `type OAuthTokenExchangeResult`
- `type OAuthTokenExchangeErrorCode`
- `interface ExchangeCodeForTokenArgs`
- `interface InboundWebhookProviderDefinition`
- `interface InboundWebhookReceiveArgs`
- `type InboundWebhookReceiveResult`
- `type IntegrationStatusBadgeKind`
- `type IntegrationStatusBadgeTone`
- `interface IntegrationStatusBadgeLabels`

### Constants & Re-exports

- `const PROVIDER_CONTRACT_VERSION: "0.1"`
- `IntegrationRegistryError`
- `const INTEGRATION_DOMAINS: readonly IntegrationDomain[]`
- `const registerNewsletter: Register`
- `const registerAnalytics: Register`
- `const registerAbTesting: Register`
- `const registerSearch: Register`
- `const registerCdnPurge: Register`
- `const registerMonitoring: Register`
- `const registerForms: Register`
- `const registerDeployHooks: Register`
- `const LISTMONK_FIELDS: ZodObject<{ baseUrl: ZodString; apiUser: ZodString; apiKey: ZodString; }, $strip>`
- `ListmonkVerifyError`
- `const PLAUSIBLE_FIELDS: ZodObject<{ host: ZodString; siteId: ZodString; apiKey: ZodString; }, $strip>`
- `PlausibleVerifyError`
- `const CLOUDFLARE_CDN_FIELDS: ZodObject<{ apiToken: ZodString; zoneId: ZodString; }, $strip>`
- `CloudflareCdnVerifyError`
- `const GITHUB_DEPLOY_FIELDS: ZodObject<{ accessToken: ZodString; }, $strip>`
- `GithubDeployVerifyError`
- `const DEFAULT_OAUTH_STATE_TTL_MS: 600000`
- `const ASTROPRESS_ADMIN_APP_NAME: "Astropress"`
- `const ASTROPRESS_ADMIN_PRODUCT_NAME: "Astropress Admin"`
- `ADMIN_STUB_PAGES`
- `adminStubs`
- `const ADMIN_LOCALE_COOKIE: "astropress_admin_locale"`
- `pageLabels`
- `const ASTROPRESS_ADMIN_BASE_PATH: "/ap-admin"`
- `const defaultSiteSettings: SiteSettings`
- `const translationStates: readonly ["not_started", "partial", "fallback_en", "translated", "reviewed", "published"]`
- `const newsletterAdapter: NewsletterAdapter`
- `const placeholderAdapter: NewsletterAdapter`
- `OAuthRegistryError`
- `InboundWebhookRegistryError`

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

- `type ApiScope`
- `type ApiTokenId`
- `interface ApiTokenRecord`
- `interface ApiTokenStore`
- `type ContentId` — A content record ID — prevents mixing with media or user IDs.
- `type MediaAssetId` — A media asset ID — prevents mixing with content or user IDs.
- `type AdminUserId` — An admin user ID — prevents mixing with content or media IDs.
- `type AuditEventId` — An audit event ID — prevents mixing with content or user IDs.
- `type ActionResult` — Standard discriminated union for all repository / action operation results.
- `type WebhookEvent`
- `interface WebhookRecord`
- `interface WebhookStore`
- `interface FaqItem` — A single FAQ item for AEO-optimised FAQPage JSON-LD.
- `interface HowToStep` — A single step in a HowTo guide for AEO-optimised HowTo JSON-LD.
- `interface AeoMetadata`

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

### Types & Interfaces

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

#### `createAstropressSqliteSeedToolkit`
```ts
function createAstropressSqliteSeedToolkit<TableName>(options: AstropressSqliteSeedToolkitOptions<TableName>): AstropressSqliteSeedToolkit<TableName>
```

#### `createDefaultAstropressSqliteSeedToolkit`
```ts
function createDefaultAstropressSqliteSeedToolkit(): AstropressSqliteSeedToolkit<"comments" | "admin_users" | "media_assets" | "redirect_rules" | "site_settings" | "cms_route_groups" | "cms_route_variants" | "cms_route_aliases" | "cms_route_revisions">
```

#### `checkSchemaVersionAhead`
```ts
function checkSchemaVersionAhead(db: SqliteDatabaseLike, frameworkBaseline: number): { isAhead: boolean; dbCount: number; frameworkCount: number; } | null
```

#### `rollbackAstropressLastMigrationWithOptions`
```ts
function rollbackAstropressLastMigrationWithOptions(db: SqliteDatabaseLike, options: { dryRun?: boolean | undefined; }): AstropressRollbackResult
```

#### `runAstropressMigrations`
```ts
function runAstropressMigrations(db: SqliteDatabaseLike, migrationsDir: string): { applied: string[]; skipped: string[]; }
```

### Types & Interfaces

- `interface ArchiveSeedRecord`
- `interface AstropressRollbackResult`
- `type AstropressRollbackStatus`
- `interface AstropressSqliteSeedToolkit`
- `interface AstropressSqliteSeedToolkitOptions`
- `interface BootstrapUserSeed`
- `interface MarketingRouteSeedRecord`
- `interface MediaSeedRecord`
- `interface RedirectRuleSeed`
- `interface SeededComment`
- `interface SeedDatabaseOptions`
- `interface SeedImportStatement`
- `interface SeedSummary`
- `interface SiteSettingsSeed`
- `interface SqliteDatabaseLike`
- `interface SqliteStatementLike`
- `interface SystemRouteSeed`

### Constants & Re-exports

- `const defaultSeedImportTables: readonly ["admin_users", "media_assets", "redirect_rules", "comments", "site_settings", "cms_route_groups", "cms_route_variants", "cms_route_aliases", "cms_route_revisions"]`
- `const ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE: 1`

---

## `astropress (cache-purge)`

### Functions

#### `purgeCdnCacheForResolved`
```ts
function purgeCdnCacheForResolved(slug: string, resolved: ResolvedCdnPurge, deps: { readonly fetch?: { (input: URL | RequestInfo, init?: RequestInit | undefined): Promise<Response>; (input: string | Request | URL, init?: RequestInit | undefined): Promise<Response>; } | undefined; }): Promise<void>
```

Issue a CDN purge for a single content slug against an already-resolved configuration. The split between this function and {@link purgeCdnCache} keeps the imperative I/O branches separate from source resolution — the resolver is unit-tested for every priority/fallback path; this function is unit-tested with mocked fetch for each `kind`. Failures are non-fatal: errors are logged with `console.warn` but never thrown, so a CDN purge failure never blocks a content publish.

#### `purgeCdnCache`
```ts
function purgeCdnCache(slug: string, config: CmsConfig, registryFields: { readonly apiToken: string; readonly zoneId: string; } | null | undefined): Promise<void>
```

Legacy entry point — purges via env (Cloudflare) and/or static `config.cdnPurgeWebhook`. Hosts that have admin-connected a Cloudflare CDN provider via the Phase 4 connect flow should call the registry-aware path instead (resolve via {@link resolveCdnPurge} with `registry` populated, then {@link purgeCdnCacheForResolved}). Backward-compatible: keeps the single-arg `(slug, config)` shape that `runtime-actions-content.ts` and downstream callers already use, so call-sites can migrate incrementally without a flag-day.

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
