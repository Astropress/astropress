export function createAstropressAdminStoreModule(getStore) {
  const store = () => getStore();

  return {
    audit: {
      getAuditEvents: (...args) => store().audit.getAuditEvents(...args),
    },
    auth: {
      createSession: (...args) => store().auth.createSession(...args),
      getSessionUser: (...args) => store().auth.getSessionUser(...args),
      getCsrfToken: (...args) => store().auth.getCsrfToken(...args),
      revokeSession: (...args) => store().auth.revokeSession(...args),
      createPasswordResetToken: (...args) => store().auth.createPasswordResetToken(...args),
      getInviteRequest: (...args) => store().auth.getInviteRequest(...args),
      getPasswordResetRequest: (...args) => store().auth.getPasswordResetRequest(...args),
      consumeInviteToken: (...args) => store().auth.consumeInviteToken(...args),
      consumePasswordResetToken: (...args) => store().auth.consumePasswordResetToken(...args),
      recordSuccessfulLogin: (...args) => store().auth.recordSuccessfulLogin(...args),
      recordLogout: (...args) => store().auth.recordLogout(...args),
    },
    users: {
      listAdminUsers: (...args) => store().users.listAdminUsers(...args),
      inviteAdminUser: (...args) => store().users.inviteAdminUser(...args),
      suspendAdminUser: (...args) => store().users.suspendAdminUser(...args),
      unsuspendAdminUser: (...args) => store().users.unsuspendAdminUser(...args),
    },
    authors: {
      listAuthors: (...args) => store().authors.listAuthors(...args),
      createAuthor: (...args) => store().authors.createAuthor(...args),
      updateAuthor: (...args) => store().authors.updateAuthor(...args),
      deleteAuthor: (...args) => store().authors.deleteAuthor(...args),
    },
    taxonomies: {
      listCategories: (...args) => store().taxonomies.listCategories(...args),
      createCategory: (...args) => store().taxonomies.createCategory(...args),
      updateCategory: (...args) => store().taxonomies.updateCategory(...args),
      deleteCategory: (...args) => store().taxonomies.deleteCategory(...args),
      listTags: (...args) => store().taxonomies.listTags(...args),
      createTag: (...args) => store().taxonomies.createTag(...args),
      updateTag: (...args) => store().taxonomies.updateTag(...args),
      deleteTag: (...args) => store().taxonomies.deleteTag(...args),
    },
    redirects: {
      getRedirectRules: (...args) => store().redirects.getRedirectRules(...args),
      createRedirectRule: (...args) => store().redirects.createRedirectRule(...args),
      deleteRedirectRule: (...args) => store().redirects.deleteRedirectRule(...args),
    },
    comments: {
      getComments: (...args) => store().comments.getComments(...args),
      moderateComment: (...args) => store().comments.moderateComment(...args),
      submitPublicComment: (...args) => store().comments.submitPublicComment(...args),
      getApprovedCommentsForRoute: (...args) => store().comments.getApprovedCommentsForRoute(...args),
    },
    content: {
      listContentStates: (...args) => store().content.listContentStates(...args),
      getContentState: (...args) => store().content.getContentState(...args),
      getContentRevisions: (...args) => store().content.getContentRevisions(...args),
      createContentRecord: (...args) => store().content.createContentRecord(...args),
      saveContentState: (...args) => store().content.saveContentState(...args),
      restoreRevision: (...args) => store().content.restoreRevision(...args),
    },
    submissions: {
      getContactSubmissions: (...args) => store().submissions.getContactSubmissions(...args),
      submitContact: (...args) => store().submissions.submitContact(...args),
    },
    translations: {
      updateTranslationState: (...args) => store().translations.updateTranslationState(...args),
      getEffectiveTranslationState: (...args) => store().translations.getEffectiveTranslationState(...args),
    },
    settings: {
      getSettings: (...args) => store().settings.getSettings(...args),
      saveSettings: (...args) => store().settings.saveSettings(...args),
    },
    rateLimits: {
      checkRateLimit: (...args) => store().rateLimits.checkRateLimit(...args),
      peekRateLimit: (...args) => store().rateLimits.peekRateLimit(...args),
      recordFailedAttempt: (...args) => store().rateLimits.recordFailedAttempt(...args),
    },
    media: {
      listMediaAssets: (...args) => store().media.listMediaAssets(...args),
      createMediaAsset: (...args) => store().media.createMediaAsset(...args),
      updateMediaAsset: (...args) => store().media.updateMediaAsset(...args),
      deleteMediaAsset: (...args) => store().media.deleteMediaAsset(...args),
    },
    createSession: (...args) => store().auth.createSession(...args),
    getSessionUser: (...args) => store().auth.getSessionUser(...args),
    getCsrfToken: (...args) => store().auth.getCsrfToken(...args),
    revokeSession: (...args) => store().auth.revokeSession(...args),
    createPasswordResetToken: (...args) => store().auth.createPasswordResetToken(...args),
    getInviteRequest: (...args) => store().auth.getInviteRequest(...args),
    getPasswordResetRequest: (...args) => store().auth.getPasswordResetRequest(...args),
    consumeInviteToken: (...args) => store().auth.consumeInviteToken(...args),
    consumePasswordResetToken: (...args) => store().auth.consumePasswordResetToken(...args),
    recordSuccessfulLogin: (...args) => store().auth.recordSuccessfulLogin(...args),
    recordLogout: (...args) => store().auth.recordLogout(...args),
    getAuditEvents: (...args) => store().audit.getAuditEvents(...args),
    listAdminUsers: (...args) => store().users.listAdminUsers(...args),
    inviteAdminUser: (...args) => store().users.inviteAdminUser(...args),
    suspendAdminUser: (...args) => store().users.suspendAdminUser(...args),
    unsuspendAdminUser: (...args) => store().users.unsuspendAdminUser(...args),
    listAuthors: (...args) => store().authors.listAuthors(...args),
    createAuthor: (...args) => store().authors.createAuthor(...args),
    updateAuthor: (...args) => store().authors.updateAuthor(...args),
    deleteAuthor: (...args) => store().authors.deleteAuthor(...args),
    listCategories: (...args) => store().taxonomies.listCategories(...args),
    createCategory: (...args) => store().taxonomies.createCategory(...args),
    updateCategory: (...args) => store().taxonomies.updateCategory(...args),
    deleteCategory: (...args) => store().taxonomies.deleteCategory(...args),
    listTags: (...args) => store().taxonomies.listTags(...args),
    createTag: (...args) => store().taxonomies.createTag(...args),
    updateTag: (...args) => store().taxonomies.updateTag(...args),
    deleteTag: (...args) => store().taxonomies.deleteTag(...args),
    getRedirectRules: (...args) => store().redirects.getRedirectRules(...args),
    createRedirectRule: (...args) => store().redirects.createRedirectRule(...args),
    deleteRedirectRule: (...args) => store().redirects.deleteRedirectRule(...args),
    getComments: (...args) => store().comments.getComments(...args),
    moderateComment: (...args) => store().comments.moderateComment(...args),
    submitPublicComment: (...args) => store().comments.submitPublicComment(...args),
    listContentStates: (...args) => store().content.listContentStates(...args),
    getContentState: (...args) => store().content.getContentState(...args),
    getContentRevisions: (...args) => store().content.getContentRevisions(...args),
    createContentRecord: (...args) => store().content.createContentRecord(...args),
    saveContentState: (...args) => store().content.saveContentState(...args),
    restoreRevision: (...args) => store().content.restoreRevision(...args),
    getContactSubmissions: (...args) => store().submissions.getContactSubmissions(...args),
    submitContact: (...args) => store().submissions.submitContact(...args),
    updateTranslationState: (...args) => store().translations.updateTranslationState(...args),
    getEffectiveTranslationState: (...args) => store().translations.getEffectiveTranslationState(...args),
    getSettings: (...args) => store().settings.getSettings(...args),
    saveSettings: (...args) => store().settings.saveSettings(...args),
    checkRateLimit: (...args) => store().rateLimits.checkRateLimit(...args),
    peekRateLimit: (...args) => store().rateLimits.peekRateLimit(...args),
    recordFailedAttempt: (...args) => store().rateLimits.recordFailedAttempt(...args),
    listMediaAssets: (...args) => store().media.listMediaAssets(...args),
    createMediaAsset: (...args) => store().media.createMediaAsset(...args),
    updateMediaAsset: (...args) => store().media.updateMediaAsset(...args),
    deleteMediaAsset: (...args) => store().media.deleteMediaAsset(...args),
  };
}

export function createAstropressPasswordAuthModule(authenticateAdminUser) {
  return {
    authenticateAdminUser,
  };
}

export function createAstropressCmsRegistryModule(registry) {
  return {
    listSystemRoutes: (...args) => registry.listSystemRoutes(...args),
    getSystemRoute: (...args) => registry.getSystemRoute(...args),
    saveSystemRoute: (...args) => registry.saveSystemRoute(...args),
    listStructuredPageRoutes: (...args) => registry.listStructuredPageRoutes(...args),
    getStructuredPageRoute: (...args) => registry.getStructuredPageRoute(...args),
    saveStructuredPageRoute: (...args) => registry.saveStructuredPageRoute(...args),
    createStructuredPageRoute: (...args) => registry.createStructuredPageRoute(...args),
    getArchiveRoute: (...args) => registry.getArchiveRoute(...args),
    listArchiveRoutes: (...args) => registry.listArchiveRoutes(...args),
    saveArchiveRoute: (...args) => registry.saveArchiveRoute(...args),
  };
}

function requireBootstrapPassword(value, name) {
  if (!value) {
    throw new Error(`${name} must be set to enable bootstrap admin authentication.`);
  }

  return value;
}

export function createAstropressBootstrapAdminUsers(input) {
  return [
    {
      email: input.adminEmail ?? "admin@example.com",
      password: requireBootstrapPassword(input.adminPassword, "ADMIN_PASSWORD"),
      role: "admin",
      name: input.adminName ?? "Admin",
    },
    {
      email: input.editorEmail ?? "editor@example.com",
      password: requireBootstrapPassword(input.editorPassword, "EDITOR_PASSWORD"),
      role: "editor",
      name: input.editorName ?? "Editor",
    },
  ];
}

export function createAstropressHostRuntimeBundle(input) {
  return {
    localAdminStoreModule: createAstropressAdminStoreModule(input.getStore),
    localAdminAuthModule: createAstropressPasswordAuthModule(input.authenticateAdminUser),
    localCmsRegistryModule: createAstropressCmsRegistryModule(input.cmsRegistry),
  };
}
