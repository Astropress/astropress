/**
 * Integration Honesty Audit
 *
 * Cross-checks two sources of truth against the actual `.astro` pages
 * under `packages/astropress/pages/ap-admin/`:
 *
 *   1. `INTEGRATIONS` (`packages/astropress/src/integration-manifest.ts`)
 *      partitions integration leaves into real / env-gated / coming-soon
 *      so the sidebar cannot lie about what works.
 *   2. `ADMIN_STUB_PAGES` (`packages/astropress/src/admin-stub-catalog.ts`)
 *      drives the dynamic `pages/ap-admin/[stub].astro` route and binds
 *      each stub slug to its `adminStubs` entry, ABAC action, and
 *      coming-soon variant.
 *
 * Rules:
 *
 *   1. Every manifest `href` resolves either to a static .astro page,
 *      or is handled by the dynamic [stub].astro route via
 *      ADMIN_STUB_PAGES.
 *   2. `status="real"` entries must NOT route through the stub catalog
 *      (a real integration cannot ship through the stub renderer) and
 *      their static page must not import RequiresIntegration.
 *   3. `status="coming-soon"` entries must route through ADMIN_STUB_PAGES
 *      with `variant="coming-soon"`. (Or, exceptionally, render
 *      RequiresIntegration variant="coming-soon" themselves.)
 *   4. Every static .astro page that imports RequiresIntegration must
 *      either match a manifest entry or appear in
 *      `NON_MANIFEST_STUB_ALLOWLIST`. The 25 dynamic-route stubs are
 *      validated through ADMIN_STUB_PAGES instead, so the allowlist
 *      no longer carries them.
 *   5. Every `ADMIN_STUB_PAGES` slug references a real `adminStubs`
 *      entry; coming-soon slugs carry a `roadmapHref`; no two slugs
 *      share an href with a static page (which would silently mask
 *      the dynamic route).
 */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
	ADMIN_STUB_PAGES,
	type AdminStubPageEntry,
	adminStubs,
} from "../../packages/astropress/src/admin-stub-catalog.js";
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
const DYNAMIC_STUB_FILE = "[stub].astro";

/**
 * Stub pages NOT covered by ADMIN_STUB_PAGES nor INTEGRATIONS — i.e.
 * static .astro files that still import RequiresIntegration directly.
 * Empty for now (the migration to [stub].astro absorbed the previous
 * 14 entries). Kept as an explicit hook so a one-off stub can be
 * justified without forcing it through the dynamic route.
 */
type AllowlistEntry = {
	reason: string;
	expectedVariant?: "coming-soon" | "env-gated";
};
const NON_MANIFEST_STUB_ALLOWLIST: ReadonlyMap<string, AllowlistEntry> =
	new Map();

const REQUIRES_INTEGRATION_IMPORT = "RequiresIntegration";

function hrefToPagePath(href: string): string {
	const trimmed = href.replace(/^\/ap-admin\/?/, "");
	return `${trimmed}.astro`;
}

function hrefToSlug(href: string): string {
	return href.replace(/^\/ap-admin\/?/, "");
}

async function loadPage(filePath: string): Promise<string | null> {
	if (!existsSync(filePath)) return null;
	const text = await readText(filePath);
	return text === "" ? null : text;
}

function pageExists(fileName: string): boolean {
	return existsSync(join(ADMIN_PAGES_DIR, fileName));
}

async function main() {
	const report = new AuditReport("integration-honesty");

	// Rules 1–3: walk the manifest, validating each entry against
	// either a static page or the dynamic stub catalog.
	for (const entry of INTEGRATIONS) {
		await checkManifestEntry(entry, report);
	}

	// Rule 5: validate ADMIN_STUB_PAGES internal coherence.
	for (const [slug, entry] of Object.entries(ADMIN_STUB_PAGES) as Array<
		[string, AdminStubPageEntry]
	>) {
		validateStubPageEntry(slug, entry, report);
		// A static page at the same slug masks the dynamic route. If a slug
		// is meant to be served by [stub].astro, no foo.astro may exist.
		const staticFile = `${slug}.astro`;
		if (pageExists(staticFile)) {
			report.add(
				`[stub-shadowed] ADMIN_STUB_PAGES slug "${slug}" is masked by static page packages/astropress/pages/ap-admin/${staticFile}. Either delete the static page or remove the slug from ADMIN_STUB_PAGES.`,
			);
		}
	}

	// Rule 4: any static page that still renders RequiresIntegration must
	// be in the manifest or the allowlist. The dynamic [stub].astro route
	// is the only place where un-listed stub rendering is permitted.
	const manifestStaticPages = new Set(
		INTEGRATIONS.filter(
			(entry) => !(hrefToSlug(entry.href) in ADMIN_STUB_PAGES),
		).map((entry) => hrefToPagePath(entry.href)),
	);
	const entries = await listFiles(ADMIN_PAGES_DIR, {
		recursive: false,
		extensions: [".astro"],
	});
	for (const fileName of entries.sort()) {
		if (fileName === DYNAMIC_STUB_FILE) continue;
		const filePath = join(ADMIN_PAGES_DIR, fileName);
		const src = await loadPage(filePath);
		if (src === null) continue;
		if (!src.includes(REQUIRES_INTEGRATION_IMPORT)) continue;
		if (manifestStaticPages.has(fileName)) continue;
		const allowlisted = NON_MANIFEST_STUB_ALLOWLIST.get(fileName);
		if (!allowlisted) {
			report.add(
				`[unregistered-stub] ${relative(ROOT, filePath)}: imports RequiresIntegration but is not in INTEGRATIONS, ADMIN_STUB_PAGES, or NON_MANIFEST_STUB_ALLOWLIST. Either register the slug in packages/astropress/src/admin-stub-catalog.ts (and delete this file so [stub].astro picks it up), add it to INTEGRATIONS, or document an exemption in NON_MANIFEST_STUB_ALLOWLIST.`,
			);
			continue;
		}
		if (allowlisted.expectedVariant === "coming-soon") {
			if (!src.includes('variant="coming-soon"')) {
				report.add(
					`[allowlist-variant-drift] ${relative(ROOT, filePath)}: allowlist expects variant="coming-soon" but page renders the default (env-gated) variant.`,
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

	// The dynamic stub renderer must exist. Without it, every slug 404s.
	if (!pageExists(DYNAMIC_STUB_FILE)) {
		report.add(
			`[missing-dynamic-stub] packages/astropress/pages/ap-admin/${DYNAMIC_STUB_FILE} does not exist; ${
				Object.keys(ADMIN_STUB_PAGES).length
			} stub slugs would 404.`,
		);
	}

	report.finish(
		`integration-honesty audit passed — ${INTEGRATIONS.length} manifest entries + ${
			Object.keys(ADMIN_STUB_PAGES).length
		} dynamic-route stubs reconciled.`,
	);
}

async function checkManifestEntry(
	entry: IntegrationEntry,
	report: AuditReport,
): Promise<void> {
	const slug = hrefToSlug(entry.href);
	const dynamicEntry = (ADMIN_STUB_PAGES as Record<string, AdminStubPageEntry>)[
		slug
	];

	if (entry.status === "real") {
		if (dynamicEntry) {
			report.add(
				`[real-but-dynamic] ${entry.href}: manifest says status="real" but slug is registered in ADMIN_STUB_PAGES. Real integrations must have their own static page; remove from ADMIN_STUB_PAGES.`,
			);
			return;
		}
		const fileName = hrefToPagePath(entry.href);
		const filePath = join(ADMIN_PAGES_DIR, fileName);
		const src = await loadPage(filePath);
		if (src === null) {
			report.add(
				`[missing-page] ${entry.href} (status=real): no backing page at ${relative(ROOT, filePath)}.`,
			);
			return;
		}
		if (src.includes(REQUIRES_INTEGRATION_IMPORT)) {
			report.add(
				`[real-but-stubbed] ${entry.href}: manifest says status="real" but ${relative(ROOT, filePath)} imports RequiresIntegration.`,
			);
		}
		return;
	}

	if (entry.status === "coming-soon") {
		if (dynamicEntry) {
			if (dynamicEntry.variant !== "coming-soon") {
				report.add(
					`[coming-soon-wrong-variant] ${entry.href}: ADMIN_STUB_PAGES["${slug}"] does not set variant="coming-soon". Add \`variant: "coming-soon"\` + a \`roadmapHref\` so operators see roadmap copy, not env-var hints.`,
				);
			}
			return;
		}
		// Fallback: a static page may still serve a coming-soon entry,
		// provided it renders RequiresIntegration variant="coming-soon".
		const fileName = hrefToPagePath(entry.href);
		const filePath = join(ADMIN_PAGES_DIR, fileName);
		const src = await loadPage(filePath);
		if (src === null) {
			report.add(
				`[missing-page] ${entry.href} (status=coming-soon): no backing page at ${relative(ROOT, filePath)} and not in ADMIN_STUB_PAGES.`,
			);
			return;
		}
		if (
			!src.includes(REQUIRES_INTEGRATION_IMPORT) ||
			!src.includes('variant="coming-soon"')
		) {
			report.add(
				`[coming-soon-wrong-variant] ${entry.href}: ${relative(ROOT, filePath)} does not render RequiresIntegration variant="coming-soon".`,
			);
		}
		return;
	}

	// env-gated: page may be either a static .astro or routed via
	// ADMIN_STUB_PAGES. Just verify it resolves.
	if (dynamicEntry) return;
	const fileName = hrefToPagePath(entry.href);
	if (!pageExists(fileName)) {
		report.add(
			`[missing-page] ${entry.href} (status=env-gated): no static page at ${fileName} and slug not in ADMIN_STUB_PAGES.`,
		);
	}
}

function validateStubPageEntry(
	slug: string,
	entry: AdminStubPageEntry,
	report: AuditReport,
): void {
	if (!(entry.stubKey in adminStubs)) {
		report.add(
			`[stub-key-missing] ADMIN_STUB_PAGES["${slug}"].stubKey="${entry.stubKey}" does not match any adminStubs entry.`,
		);
	}
	if (entry.variant === "coming-soon" && !entry.roadmapHref) {
		report.add(
			`[stub-missing-roadmap] ADMIN_STUB_PAGES["${slug}"] has variant="coming-soon" but no roadmapHref. Coming-soon pages must surface a roadmap link instead of env-var hints.`,
		);
	}
	if (entry.variant !== "coming-soon" && entry.roadmapHref) {
		report.add(
			`[stub-stale-roadmap] ADMIN_STUB_PAGES["${slug}"] has roadmapHref but no variant="coming-soon". Drop the roadmapHref or add the variant.`,
		);
	}
}

runAudit("integration-honesty", main);
