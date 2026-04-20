import type { safeLoadLocalAdminStore } from "./admin-store-dispatch";
import type { D1AdminReadStore } from "./d1-admin-store";
import type { ContentRecord, ContentStatus } from "./persistence-types";
import { defaultSiteSettings } from "./site-settings";

export type SeededContentRecord = ContentRecord & {
	id?: string;
	locale?: string;
	listingItems: unknown[];
	paginationLinks: unknown[];
};

export function normalizeContentStatus(value: unknown): ContentStatus {
	if (
		value === "draft" ||
		value === "review" ||
		value === "published" ||
		value === "archived"
	) {
		return value;
	}

	return "published";
}

export function createStaticReadStore(
	getSeededContentRecords: () => SeededContentRecord[],
): D1AdminReadStore {
	return {
		audit: {
			getAuditEvents: async () => [],
		},
		users: {
			listAdminUsers: async () => [],
		},
		authors: {
			listAuthors: async () => [],
		},
		taxonomies: {
			listCategories: async () => [],
			listTags: async () => [],
		},
		redirects: {
			getRedirectRules: async () => [],
		},
		comments: {
			getComments: async () => [],
			getApprovedCommentsForRoute: async () => [],
		},
		content: {
			listContentStates: async () => getSeededContentRecords(),
			getContentState: async (slug: string) =>
				getSeededContentRecords().find(
					(record) => record.slug === slug || record.legacyUrl === `/${slug}`,
				) ?? null,
			getContentRevisions: async () => null,
		},
		submissions: {
			getContactSubmissions: async () => [],
			getTestimonials: async () => [],
		},
		translations: {
			getEffectiveTranslationState: async (
				_route: string,
				fallback = "not_started",
			) => fallback,
		},
		settings: {
			getSettings: async () => defaultSiteSettings,
		},
		rateLimits: {
			checkRateLimit: async () => true,
			peekRateLimit: async () => true,
			recordFailedAttempt: async () => {},
		},
		media: {
			listMediaAssets: async () => [],
		},
	};
}

export function createFallbackReadStore(
	localAdminStore: Awaited<ReturnType<typeof safeLoadLocalAdminStore>>,
	getSeededContentRecords: () => SeededContentRecord[],
): D1AdminReadStore {
	if (!localAdminStore) {
		return createStaticReadStore(getSeededContentRecords);
	}

	return {
		audit: {
			getAuditEvents: async () => localAdminStore.getAuditEvents(),
		},
		users: {
			listAdminUsers: async () =>
				localAdminStore.listAdminUsers().map((user) => ({
					...user,
					role: user.role,
					status:
						user.status === "active" ||
						user.status === "invited" ||
						user.status === "suspended"
							? user.status
							: "active",
				})),
		},
		authors: {
			listAuthors: async () => localAdminStore.listAuthors(),
		},
		taxonomies: {
			listCategories: async () => localAdminStore.listCategories(),
			listTags: async () => localAdminStore.listTags(),
		},
		redirects: {
			getRedirectRules: async () => localAdminStore.getRedirectRules(),
		},
		comments: {
			getComments: async () => localAdminStore.getComments(),
			getApprovedCommentsForRoute: async (route: string) =>
				localAdminStore
					.getComments()
					.filter(
						(comment) =>
							comment.route === route && comment.status === "approved",
					),
		},
		content: {
			listContentStates: async () => localAdminStore.listContentStates(),
			getContentState: async (slug: string) =>
				localAdminStore.getContentState(slug),
			getContentRevisions: async (slug: string) =>
				localAdminStore.getContentRevisions(slug),
		},
		submissions: {
			getContactSubmissions: async () =>
				localAdminStore.getContactSubmissions(),
			getTestimonials: async (status?) =>
				localAdminStore.getTestimonials(status),
		},
		translations: {
			getEffectiveTranslationState: async (
				route: string,
				fallback = "not_started",
			) => localAdminStore.getEffectiveTranslationState(route, fallback),
		},
		settings: {
			getSettings: async () => localAdminStore.getSettings(),
		},
		rateLimits: {
			checkRateLimit: async () => true,
			peekRateLimit: async () => true,
			recordFailedAttempt: async () => {},
		},
		media: {
			listMediaAssets: async () => localAdminStore.listMediaAssets(),
		},
	};
}
