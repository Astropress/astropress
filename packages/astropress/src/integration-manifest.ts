/**
 * Single source of truth for what is and isn't a real integration.
 *
 * Operators landing on /ap-admin can't tell hollow stubs from working
 * features when they sit side-by-side under one "Integrations" sidebar
 * group. This manifest partitions every leaf that previously lived under
 * `groupIntegrations` into three honest buckets:
 *
 *   - "real"        — fully implemented, no env-var gating required.
 *   - "env-gated"   — implementation exists, surfaces a connect screen
 *                     until the corresponding `CmsConfig` field is set.
 *   - "coming-soon" — listed for roadmap visibility only. The page must
 *                     render `<RequiresIntegration variant="coming-soon">`
 *                     and may NOT show env-var copy-paste hints.
 *
 * `audit:integration-honesty` cross-checks this manifest against the
 * actual page files so the partition stays truthful as the codebase
 * evolves. The plugin sidebar and AdminLayout both read from
 * `INTEGRATIONS`; adding or moving an integration is a single edit here.
 */
import type { CmsConfig } from "./config";

export type IntegrationStatus = "real" | "env-gated" | "coming-soon";

export interface IntegrationEntry {
	/** Sidebar href, e.g. "/ap-admin/analytics". */
	readonly href: string;
	/** Key on `adminUi.navigation` for the localised leaf label. */
	readonly navKey: string;
	readonly status: IntegrationStatus;
	/**
	 * For `env-gated`: the `CmsConfig` field whose presence flips the
	 * page from "configure me" to "connected". Used by Phase 2 to show
	 * a status badge in the sidebar; ignored for other statuses.
	 */
	readonly configField?: keyof CmsConfig;
	/**
	 * For `coming-soon`: GitHub issue URL where the roadmap for this
	 * integration is tracked. Surfaced by `RequiresIntegration` instead
	 * of an env-var copy-paste hint.
	 */
	readonly roadmapHref?: string;
	/** ABAC action required to surface the leaf in the sidebar. */
	readonly requiredAction: string;
	/** Whether the leaf is admin-only. Mirrors AdminLayout `leaf({adminOnly})`. */
	readonly adminOnly: boolean;
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
	// The plugin registry is real (registered plugin nav items render
	// alongside core leaves), but the marketplace / management page at
	// /ap-admin/plugins does not exist yet — it's a stub. Track separately.
	{
		href: "/ap-admin/plugins",
		navKey: "plugins",
		status: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
		requiredAction: "plugins:view",
		adminOnly: true,
	},

	// Env-gated — implementation exists; page surfaces RequiresIntegration
	// until the matching CmsConfig field is set.
	{
		href: "/ap-admin/analytics",
		navKey: "analytics",
		status: "env-gated",
		configField: "analytics",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/ab-testing",
		navKey: "abTesting",
		status: "env-gated",
		configField: "abTesting",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/search",
		navKey: "search",
		status: "env-gated",
		configField: "search",
		requiredAction: "services:manage",
		adminOnly: true,
	},
	{
		href: "/ap-admin/cdn-purge",
		navKey: "cdnPurge",
		status: "env-gated",
		configField: "cdnPurgeWebhook",
		requiredAction: "settings:edit",
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

export function integrationsByStatus(
	status: IntegrationStatus,
): readonly IntegrationEntry[] {
	return INTEGRATIONS.filter((entry) => entry.status === status);
}

export function findIntegrationByHref(
	href: string,
): IntegrationEntry | undefined {
	return INTEGRATIONS.find((entry) => entry.href === href);
}
