/**
 * Static catalogue of /ap-admin integrations and their honesty tier.
 *
 * Split from integration-manifest.ts so the pure-data manifest is not
 * mutation-tested: each entry is a top-level static mutant whose value
 * (href strings, navKey strings, status enum) only restates the typed
 * shape. Behavioural accessors (`integrationsByStatus`, `findIntegrationByHref`)
 * live in integration-manifest.ts and are mutation-tested there.
 *
 * `audit:integration-honesty` cross-checks this manifest against the
 * actual page files so the partition stays truthful as the codebase
 * evolves. The plugin sidebar and AdminLayout both read from
 * `INTEGRATIONS`; adding or moving an integration is a single edit here.
 */
import type { CmsConfig } from "./config";
import type { IntegrationDomain } from "./integrations/registry";

export type IntegrationStatus = "real" | "env-gated" | "coming-soon";

export interface IntegrationEntry {
	/** Sidebar href, e.g. "/ap-admin/analytics". */
	readonly href: string;
	/** Key on `adminUi.navigation` for the localised leaf label. */
	readonly navKey: string;
	readonly status: IntegrationStatus;
	/**
	 * For `env-gated`: the `CmsConfig` field whose presence flips the
	 * page from "configure me" to "connected".
	 */
	readonly configField?: keyof CmsConfig;
	/**
	 * For `coming-soon`: GitHub issue URL where the roadmap for this
	 * integration is tracked.
	 */
	readonly roadmapHref?: string;
	/** ABAC action required to surface the leaf in the sidebar. */
	readonly requiredAction: string;
	/** Whether the leaf is admin-only. */
	readonly adminOnly: boolean;
	/**
	 * For Phase 3/4-aware leaves: the integration domain whose
	 * `connected_integrations` rows drive the sidebar status badge.
	 */
	readonly domain?: IntegrationDomain;
}

const ROADMAP_ISSUE = "https://github.com/Astropress/astropress/issues/76";

export const INTEGRATIONS: readonly IntegrationEntry[] = [
	// Real — handlers exist, no env gating required.
	{
		href: "/ap-admin/services",
		navKey: "services",
		status: "real",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/api-tokens",
		navKey: "apiTokens",
		status: "real",
		requiredAction: "apiTokens:create",
		adminOnly: true,
	},
	{
		href: "/ap-admin/webhooks",
		navKey: "webhooks",
		status: "real",
		requiredAction: "webhooks:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/plugins",
		navKey: "plugins",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "plugins:view",
		adminOnly: true,
	},

	// Real — Phase 5 admin pages render IntegrationConnect against the
	// per-domain provider registry; admin connect actions persist via
	// the Phase 2 envelope.
	{
		href: "/ap-admin/newsletter",
		navKey: "newsletter",
		status: "real",
		domain: "newsletter",
		requiredAction: "newsletter:send",
		adminOnly: true,
	},
	{
		href: "/ap-admin/analytics",
		navKey: "analytics",
		status: "real",
		domain: "analytics",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/search",
		navKey: "search",
		status: "real",
		domain: "search",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/cdn-purge",
		navKey: "cdnPurge",
		status: "real",
		domain: "cdn-purge",
		requiredAction: "settings:edit",
		adminOnly: true,
	},
	{
		href: "/ap-admin/forms",
		navKey: "forms",
		status: "real",
		domain: "forms",
		requiredAction: "forms:view",
		adminOnly: true,
	},

	// Env-gated — implementation exists; page surfaces RequiresIntegration
	// until the matching CmsConfig field is set.
	{
		href: "/ap-admin/ab-testing",
		navKey: "abTesting",
		status: "env-gated",
		configField: "abTesting",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/monitoring",
		navKey: "monitoring",
		status: "env-gated",
		configField: "monitoring",
		requiredAction: "services:manage",
		adminOnly: true,
	},

	// Coming-soon — no implementation. Sidebar must visually demote;
	// page must use variant="coming-soon" (no env-var hints).
	{
		href: "/ap-admin/heatmaps",
		navKey: "heatmaps",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/email",
		navKey: "email",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/live-chat",
		navKey: "liveChat",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/image-cdn",
		navKey: "imageCdn",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/deploy-hooks",
		navKey: "deployHooks",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "settings:edit",
		adminOnly: true,
	},
];
