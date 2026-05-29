// stryker-disable-file: data-only — section names + flat-method routing
// table for the host-runtime-factories Proxy. No conditional logic; pure
// const data.

import type { AdminStoreAdapter } from "./persistence-types";

export type AdminStoreSection =
	| "audit"
	| "auth"
	| "users"
	| "authors"
	| "taxonomies"
	| "redirects"
	| "comments"
	| "content"
	| "submissions"
	| "translations"
	| "settings"
	| "rateLimits"
	| "media";

// Compile-time assertion: every section listed above must exist on
// AdminStoreAdapter. If a section is renamed or removed upstream, this
// satisfies-style annotation surfaces the drift at typecheck time.
const _ADMIN_STORE_SECTION_TYPECHECK: Record<AdminStoreSection, keyof AdminStoreAdapter> = {
	audit: "audit",
	auth: "auth",
	users: "users",
	authors: "authors",
	taxonomies: "taxonomies",
	redirects: "redirects",
	comments: "comments",
	content: "content",
	submissions: "submissions",
	translations: "translations",
	settings: "settings",
	rateLimits: "rateLimits",
	media: "media",
};
void _ADMIN_STORE_SECTION_TYPECHECK;

/**
 * Optional admin-store surfaces that are objects, not method tables. Unlike the
 * sections above they are absent on DB-less hosts, so the flattened module must
 * expose the *actual* value (which may be `undefined`) rather than a section
 * proxy — callers rely on `store.apiTokens` being falsy to detect absence.
 * Wrapping them in a proxy (always truthy) would defeat that guard, which is
 * why they are dispatched separately in createAstropressAdminStoreModule.
 */
export const ADMIN_STORE_OPTIONAL_OBJECT_KEYS: ReadonlySet<string> = new Set<
	keyof AdminStoreAdapter
>(["apiTokens", "webhooks", "flash", "integrations"]);

export const ADMIN_STORE_SECTIONS: ReadonlySet<string> = new Set<AdminStoreSection>([
	"audit",
	"auth",
	"users",
	"authors",
	"taxonomies",
	"redirects",
	"comments",
	"content",
	"submissions",
	"translations",
	"settings",
	"rateLimits",
	"media",
]);

// Flat-method mirror exposed by LocalAdminStoreModule. Each key maps to the
// section it forwards to. Methods present only on the nested form (e.g.
// getApprovedCommentsForRoute, getTestimonials) are intentionally absent from
// this table so the Proxy treats them as nested-only — matching the previous
// hand-authored factory.
export const ADMIN_STORE_FLAT_METHOD_SECTIONS: Readonly<Record<string, AdminStoreSection>> = {
	createSession: "auth",
	getSessionUser: "auth",
	getCsrfToken: "auth",
	revokeSession: "auth",
	createPasswordResetToken: "auth",
	getInviteRequest: "auth",
	getPasswordResetRequest: "auth",
	consumeInviteToken: "auth",
	consumePasswordResetToken: "auth",
	recordSuccessfulLogin: "auth",
	recordLogout: "auth",
	getAuditEvents: "audit",
	recordAuditEvent: "audit",
	listAdminUsers: "users",
	inviteAdminUser: "users",
	suspendAdminUser: "users",
	unsuspendAdminUser: "users",
	listAuthors: "authors",
	createAuthor: "authors",
	updateAuthor: "authors",
	deleteAuthor: "authors",
	listCategories: "taxonomies",
	createCategory: "taxonomies",
	updateCategory: "taxonomies",
	deleteCategory: "taxonomies",
	listTags: "taxonomies",
	createTag: "taxonomies",
	updateTag: "taxonomies",
	deleteTag: "taxonomies",
	getRedirectRules: "redirects",
	createRedirectRule: "redirects",
	deleteRedirectRule: "redirects",
	getComments: "comments",
	moderateComment: "comments",
	submitPublicComment: "comments",
	listContentStates: "content",
	getContentState: "content",
	getContentRevisions: "content",
	createContentRecord: "content",
	saveContentState: "content",
	restoreRevision: "content",
	getContactSubmissions: "submissions",
	submitContact: "submissions",
	updateTranslationState: "translations",
	getEffectiveTranslationState: "translations",
	getSettings: "settings",
	saveSettings: "settings",
	checkRateLimit: "rateLimits",
	peekRateLimit: "rateLimits",
	recordFailedAttempt: "rateLimits",
	listMediaAssets: "media",
	createMediaAsset: "media",
	updateMediaAsset: "media",
	deleteMediaAsset: "media",
};
