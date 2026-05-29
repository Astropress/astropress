// stryker-disable-file: data-only — static nav route→ABAC-action map. This is the
// single source of truth for which fine-grained action each core admin nav leaf
// requires; AdminLayout builds its sidebar leaves from it and
// audit-abac-enforcement-parity derives its page→action parity checks from it.
// No runtime branching lives here, so it carries no behavioural mutants.

/**
 * One core admin navigation leaf and the ABAC action that gates it.
 *
 * `requiredAction` is mirrored by `AdminLayout` (nav filtering) AND must match
 * the `requiresAccess(...)` guard on the destination page when that page guards
 * via the page-guard helper — the parity the abac audit enforces. `adminOnly`
 * is the legacy break-glass fallback used only when no access engine is wired.
 *
 * Integration leaves are NOT listed here: they are generated from the
 * `INTEGRATIONS` manifest, which carries its own `requiredAction`/`adminOnly`.
 */
export interface NavActionEntry {
	href: string;
	requiredAction: string;
	adminOnly?: boolean;
}

export const NAV_ACTION_MAP: readonly NavActionEntry[] = [
	// Site
	{ href: "/ap-admin/pages", requiredAction: "pages:list", adminOnly: true },
	{ href: "/ap-admin/route-pages", requiredAction: "routePages:edit", adminOnly: true },
	{ href: "/ap-admin/archives", requiredAction: "archives:edit", adminOnly: true },
	{ href: "/ap-admin/media", requiredAction: "media:list" },
	{ href: "/ap-admin/redirects", requiredAction: "redirects:manage", adminOnly: true },
	{ href: "/ap-admin/forms", requiredAction: "forms:view" },

	// Content
	{ href: "/ap-admin/posts", requiredAction: "posts:list" },
	{ href: "/ap-admin/authors", requiredAction: "authors:manage", adminOnly: true },
	{ href: "/ap-admin/taxonomies", requiredAction: "taxonomies:manage", adminOnly: true },
	{ href: "/ap-admin/cms", requiredAction: "settings:edit" },

	// Audience
	{ href: "/ap-admin/subscribers", requiredAction: "subscribers:view", adminOnly: true },
	{ href: "/ap-admin/newsletter", requiredAction: "newsletter:send", adminOnly: true },
	{ href: "/ap-admin/comments", requiredAction: "comments:moderate" },
	{ href: "/ap-admin/events", requiredAction: "events:manage", adminOnly: true },
	{ href: "/ap-admin/testimonials", requiredAction: "testimonials:manage", adminOnly: true },
	{ href: "/ap-admin/reviews", requiredAction: "testimonials:manage", adminOnly: true },
	{ href: "/ap-admin/referrals", requiredAction: "services:manage", adminOnly: true },
	{ href: "/ap-admin/memberships", requiredAction: "services:manage", adminOnly: true },
	{ href: "/ap-admin/fundraising", requiredAction: "fundraising:manage", adminOnly: true },
	{ href: "/ap-admin/community", requiredAction: "services:manage", adminOnly: true },
	{ href: "/ap-admin/shop", requiredAction: "services:manage", adminOnly: true },
	{ href: "/ap-admin/social-syndication", requiredAction: "services:manage", adminOnly: true },

	// Discoverability
	{ href: "/ap-admin/seo", requiredAction: "seo:edit", adminOnly: true },
	{ href: "/ap-admin/structured-data", requiredAction: "seo:edit", adminOnly: true },
	{ href: "/ap-admin/sitemaps", requiredAction: "sitemaps:view", adminOnly: true },
	{ href: "/ap-admin/maps-local", requiredAction: "seo:edit", adminOnly: true },
	{ href: "/ap-admin/translations", requiredAction: "translations:manage", adminOnly: true },

	// Access
	{ href: "/ap-admin/users", requiredAction: "users:list", adminOnly: true },
	{ href: "/ap-admin/access", requiredAction: "roles:manage", adminOnly: true },

	// Operations
	{ href: "/ap-admin/system", requiredAction: "system:view", adminOnly: true },
	{ href: "/ap-admin/host", requiredAction: "host:view", adminOnly: true },
	{ href: "/ap-admin/data", requiredAction: "data:view", adminOnly: true },
	{ href: "/ap-admin/settings", requiredAction: "settings:edit", adminOnly: true },
	{ href: "/ap-admin/backups", requiredAction: "backups:manage", adminOnly: true },
];

/** Lookup map keyed by href for O(1) nav-leaf construction. */
export const NAV_ACTION_BY_HREF: ReadonlyMap<string, NavActionEntry> = new Map(
	NAV_ACTION_MAP.map((entry) => [entry.href, entry]),
);
