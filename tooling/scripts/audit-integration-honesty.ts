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
 */
const NON_MANIFEST_STUB_ALLOWLIST: ReadonlyMap<string, string> = new Map([
	["forms.astro", "groupSite — forms ingestion stub (Phase 5: real)"],
	["newsletter.astro", "groupAudience — Listmonk env-gated (Phase 4: real)"],
	["events.astro", "groupAudience — events stub (Phase 5: coming-soon)"],
	["reviews.astro", "groupAudience — reviews stub (Phase 5: coming-soon)"],
	["referrals.astro", "groupAudience — referrals stub (Phase 5: coming-soon)"],
	[
		"memberships.astro",
		"groupAudience — memberships stub (Phase 5: coming-soon)",
	],
	["community.astro", "groupAudience — community stub (Phase 5: coming-soon)"],
	["shop.astro", "groupAudience — shop stub (Phase 5: coming-soon)"],
	[
		"social-syndication.astro",
		"groupAudience — social-syndication stub (Phase 5: coming-soon)",
	],
	[
		"structured-data.astro",
		"groupDiscoverability — structured-data stub (Phase 5)",
	],
	["sitemaps.astro", "groupDiscoverability — sitemaps stub (Phase 5)"],
	["maps-local.astro", "groupDiscoverability — maps-local stub (Phase 5)"],
	["data.astro", "groupOperations — data stub (Phase 5: re-categorise)"],
	["backups.astro", "groupOperations — backups stub (Phase 5: re-categorise)"],
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
		if (NON_MANIFEST_STUB_ALLOWLIST.has(fileName)) continue;
		report.add(
			`[unregistered-stub] ${relative(ROOT, filePath)}: imports RequiresIntegration but is not in INTEGRATIONS manifest or NON_MANIFEST_STUB_ALLOWLIST. ` +
				"Either register it in packages/astropress/src/integration-manifest.ts, " +
				"or add it to the allowlist in tooling/scripts/audit-integration-honesty.ts with a justification.",
		);
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
