/**
 * Integration Honesty Audit
 *
 * Cross-checks the `INTEGRATIONS` manifest in
 * `packages/astropress/src/integration-manifest.ts` against the actual
 * `.astro` page files under `packages/astropress/pages/ap-admin/` so
 * the sidebar partition can never lie about what's real.
 *
 * Rules enforced (every failure includes the manifest entry that drove
 * the check + a pointer to the offending file):
 *
 *   1. Every manifest `href` resolves to an existing .astro page.
 *   2. Every `status: "real"` entry has a page that does NOT import
 *      RequiresIntegration. (A real integration cannot ship a stub.)
 *   3. Every `status: "coming-soon"` entry has a page that DOES import
 *      RequiresIntegration AND passes `variant="coming-soon"`. (An
 *      "on the roadmap" page must say so honestly.)
 *   4. Every `.astro` page under pages/ap-admin/ that imports
 *      RequiresIntegration is either (a) listed in the manifest, or
 *      (b) an env-var-gated feature outside the integration sidebar
 *      group (e.g. `forms.astro`, `subscribers.astro`). The audit
 *      surfaces drift via a hard-coded allowlist of known non-manifest
 *      stubs; new stubs MUST be added to the manifest or the allowlist.
 *
 * Why a separate allowlist instead of "every stub is in the manifest":
 * the manifest only owns leaves that *previously* lived under
 * `groupIntegrations`. Pages like `/ap-admin/forms` are stubs but live
 * in the Site group (Phase 5 will re-categorise them). Until then we
 * record them explicitly so accidental new stubs surface as audit
 * failures.
 */

import { join, relative } from "node:path";
import {
	INTEGRATIONS,
	type IntegrationEntry,
} from "../../packages/astropress/src/integration-manifest.js";
import {
	AuditReport,
	ROOT,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const ADMIN_PAGES_DIR = fromRoot("packages/astropress/pages/ap-admin");

/**
 * Stub pages that are deliberately NOT in the integration manifest.
 * These live in non-integration sidebar groups (Site/Audience/etc.).
 * Phase 5 of the integration-honesty rollout will reclassify them.
 * Until then, every entry must be justified — adding a new admin stub
 * without registering it in the manifest is an audit failure.
 *
 * `expectedVariant` (when set) drives an additional check: the page
 * MUST render `<RequiresIntegration variant="<that>">`. This is how
 * we keep coming-soon pages from drifting back to env-gated copy
 * without anyone noticing.
 */
type AllowlistEntry = {
	reason: string;
	expectedVariant?: "coming-soon" | "env-gated";
};
const NON_MANIFEST_STUB_ALLOWLIST: ReadonlyMap<string, AllowlistEntry> =
	new Map([
		[
			"forms.astro",
			{ reason: "groupSite — forms ingestion env-gated stub" },
		],
		[
			"newsletter.astro",
			{ reason: "groupAudience — Listmonk env-gated (Phase 4: real)" },
		],
		[
			"events.astro",
			{
				reason: "groupAudience — events stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"reviews.astro",
			{
				reason: "groupAudience — reviews stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"referrals.astro",
			{
				reason: "groupAudience — referrals stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"memberships.astro",
			{
				reason: "groupAudience — memberships stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"community.astro",
			{
				reason: "groupAudience — community stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"shop.astro",
			{ reason: "groupAudience — shop stub (Phase 4+: real provider)" },
		],
		[
			"social-syndication.astro",
			{
				reason: "groupAudience — social-syndication stub (no implementation)",
				expectedVariant: "coming-soon",
			},
		],
		[
			"structured-data.astro",
			{ reason: "groupDiscoverability — structured-data stub (Phase 5)" },
		],
		[
			"sitemaps.astro",
			{ reason: "groupDiscoverability — sitemaps stub (Phase 5)" },
		],
		[
			"maps-local.astro",
			{ reason: "groupDiscoverability — maps-local stub (Phase 5)" },
		],
		[
			"data.astro",
			{ reason: "groupOperations — data stub (Phase 5: re-categorise)" },
		],
		[
			"backups.astro",
			{ reason: "groupOperations — backups stub (Phase 5: re-categorise)" },
		],
	]);

const REQUIRES_INTEGRATION_IMPORT = "RequiresIntegration";

function hrefToPagePath(href: string): string {
	// "/ap-admin/heatmaps" -> "heatmaps.astro"
	const trimmed = href.replace(/^\/ap-admin\/?/, "");
	return `${trimmed}.astro`;
}

async function loadPage(filePath: string): Promise<string | null> {
	try {
		return await readText(filePath);
	} catch {
		return null;
	}
}

async function main() {
	const report = new AuditReport("integration-honesty");

	// Rule 1+2+3: walk the manifest.
	for (const entry of INTEGRATIONS) {
		await checkManifestEntry(entry, report);
	}

	// Rule 4: walk every admin page, flag stubs not in manifest+allowlist.
	const manifestPages = new Set(
		INTEGRATIONS.map((entry) => hrefToPagePath(entry.href)),
	);
	const entries = await listFiles(ADMIN_PAGES_DIR, {
		recursive: false,
		extensions: [".astro"],
	});
	for (const fileName of entries.sort()) {
		const filePath = join(ADMIN_PAGES_DIR, fileName);
		const src = await loadPage(filePath);
		if (src === null) continue;
		if (!src.includes(REQUIRES_INTEGRATION_IMPORT)) continue;
		if (manifestPages.has(fileName)) continue;
		const allowlisted = NON_MANIFEST_STUB_ALLOWLIST.get(fileName);
		if (!allowlisted) {
			report.add(
				`[unregistered-stub] ${relative(ROOT, filePath)}: imports RequiresIntegration but is not in INTEGRATIONS manifest or NON_MANIFEST_STUB_ALLOWLIST. ` +
					"Either register it in packages/astropress/src/integration-manifest.ts, " +
					"or add it to the allowlist in tooling/scripts/audit-integration-honesty.ts with a justification.",
			);
			continue;
		}
		// When the allowlist commits to a variant, verify the page renders it.
		// Coming-soon pages must not silently revert to env-gated copy: the
		// env-var hint would lie about the integration's existence.
		if (allowlisted.expectedVariant === "coming-soon") {
			if (!src.includes('variant="coming-soon"')) {
				report.add(
					`[allowlist-variant-drift] ${relative(ROOT, filePath)}: allowlist expects variant="coming-soon" but page renders the default (env-gated) variant. ` +
						"Add `variant=\"coming-soon\"` + a `roadmapHref` to the RequiresIntegration props, or relax the allowlist entry.",
				);
			}
		} else if (allowlisted.expectedVariant === "env-gated") {
			if (src.includes('variant="coming-soon"')) {
				report.add(
					`[allowlist-variant-drift] ${relative(ROOT, filePath)}: allowlist expects env-gated variant but page renders variant="coming-soon".`,
				);
			}
		}
	}

	report.finish(
		`integration-honesty audit passed — ${INTEGRATIONS.length} manifest entries reconciled with admin pages.`,
	);
}

async function checkManifestEntry(
	entry: IntegrationEntry,
	report: AuditReport,
): Promise<void> {
	const fileName = hrefToPagePath(entry.href);
	const filePath = join(ADMIN_PAGES_DIR, fileName);
	const src = await loadPage(filePath);
	if (src === null) {
		report.add(
			`[missing-page] ${entry.href} (status=${entry.status}): manifest entry has no backing page at ${relative(ROOT, filePath)}.`,
		);
		return;
	}
	const importsRequiresIntegration = src.includes(REQUIRES_INTEGRATION_IMPORT);

	if (entry.status === "real" && importsRequiresIntegration) {
		report.add(
			`[real-but-stubbed] ${entry.href}: manifest says status="real" but ${relative(ROOT, filePath)} imports RequiresIntegration. ` +
				'Either implement the page, or change manifest status to "env-gated"/"coming-soon".',
		);
	}

	if (entry.status === "coming-soon") {
		if (!importsRequiresIntegration) {
			report.add(
				`[coming-soon-not-stubbed] ${entry.href}: manifest says status="coming-soon" but ${relative(ROOT, filePath)} does not render RequiresIntegration.`,
			);
			return;
		}
		if (!src.includes('variant="coming-soon"')) {
			report.add(
				`[coming-soon-wrong-variant] ${entry.href}: ${relative(ROOT, filePath)} renders RequiresIntegration without variant="coming-soon". ` +
					"Operators must see roadmap copy, not env-var hints.",
			);
		}
	}
}

runAudit("integration-honesty", main);
