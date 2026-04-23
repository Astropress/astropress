/**
 * audit-aeo.ts
 *
 * Verifies all AEO/SEO features described in Rubric 21:
 *   - JSON-LD components: FAQ, HowTo, SpeakableSpecification, BreadcrumbList, Article
 *   - AstropressSeoHead: Open Graph meta tags + canonical link
 *   - sitemap.xml page endpoint
 *   - llms.txt page endpoint (AI crawler)
 *   - DonateAction JSON-LD in donations.ts
 *   - Content layout auto-wiring
 *   - AeoMetadata type exports in platform-contracts.ts
 *
 * Exit 0 — all components present and structurally valid.
 * Exit 1 — one or more components are missing or malformed.
 */

import { join } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const componentsRoot = fromRoot("packages/astropress/components");
const pagesRoot = fromRoot("packages/astropress/pages");
const srcRoot = fromRoot("packages/astropress/src");

const requiredComponents: Array<{
	name: string;
	file: string;
	checks: string[];
}> = [
	{
		name: "AstropressFaqJsonLd",
		file: "AstropressFaqJsonLd.astro",
		checks: ["FAQPage", "mainEntity", "acceptedAnswer"],
	},
	{
		name: "AstropressHowToJsonLd",
		file: "AstropressHowToJsonLd.astro",
		checks: ["HowTo", "HowToStep", "step"],
	},
	{
		name: "AstropressSpeakableJsonLd",
		file: "AstropressSpeakableJsonLd.astro",
		checks: ["SpeakableSpecification", "WebPage", "speakable"],
	},
	{
		name: "AstropressBreadcrumbJsonLd",
		file: "AstropressBreadcrumbJsonLd.astro",
		checks: ["BreadcrumbList", "ListItem"],
	},
	{
		name: "AstropressArticleJsonLd",
		file: "AstropressArticleJsonLd.astro",
		checks: ["Article"],
	},
];

const contentLayoutComponent = {
	name: "AstropressContentLayout",
	file: "AstropressContentLayout.astro",
	checks: [
		"faqItems",
		"howToSteps",
		"speakableCssSelectors",
		"data-ap-content-layout",
	],
};

async function auditComponent(
	report: AuditReport,
	name: string,
	file: string,
	checks: string[],
): Promise<void> {
	const fullPath = join(componentsRoot, file);
	if (!(await fileExists(fullPath))) {
		report.add(`MISSING: ${name} (${file})`);
		return;
	}

	const source = await readText(fullPath);
	for (const check of checks) {
		if (!source.includes(check)) {
			report.add(
				`MALFORMED: ${name} (${file}) — missing required string "${check}"`,
			);
		}
	}
}

async function main() {
	const report = new AuditReport("aeo");

	// Audit the five core AEO JSON-LD components
	for (const component of requiredComponents) {
		await auditComponent(report, component.name, component.file, component.checks);
	}

	// Audit the content layout auto-wiring component
	await auditComponent(
		report,
		contentLayoutComponent.name,
		contentLayoutComponent.file,
		contentLayoutComponent.checks,
	);

	// ── Open Graph + canonical: AstropressSeoHead.astro ──
	const seoHeadPath = join(componentsRoot, "AstropressSeoHead.astro");
	if (!(await fileExists(seoHeadPath))) {
		report.add("MISSING: AstropressSeoHead.astro — Open Graph and canonical tags required");
	} else {
		const seoSrc = await readText(seoHeadPath);
		for (const token of ["og:title", "og:description", "canonical"]) {
			if (!seoSrc.includes(token)) {
				report.add(`MALFORMED: AstropressSeoHead.astro — missing "${token}"`);
			}
		}
	}

	// ── sitemap.xml endpoint ──
	const sitemapPath = join(pagesRoot, "sitemap.xml.ts");
	if (!(await fileExists(sitemapPath))) {
		report.add("MISSING: pages/sitemap.xml.ts — sitemap.xml endpoint required for AEO");
	}

	// ── llms.txt endpoint (AI crawlers) ──
	// May be .ts or .js (compiled output served alongside source)
	const llmsTsPath = join(pagesRoot, "llms.txt.ts");
	const llmsJsPath = join(pagesRoot, "llms.txt.js");
	if (!(await fileExists(llmsTsPath)) && !(await fileExists(llmsJsPath))) {
		report.add("MISSING: pages/llms.txt.ts — llms.txt endpoint required for AI crawler AEO");
	}

	// ── DonateAction JSON-LD in donations.ts ──
	const donationsPath = join(srcRoot, "donations.ts");
	if (!(await fileExists(donationsPath))) {
		report.add("MISSING: src/donations.ts — DonateAction JSON-LD generator required");
	} else {
		const donationsSrc = await readText(donationsPath);
		if (!donationsSrc.includes("DonateAction")) {
			report.add('MALFORMED: src/donations.ts — missing "DonateAction" schema.org type');
		}
	}

	// Verify AeoMetadata types are exported from platform-contracts
	const contractsPath = fromRoot("packages/astropress/src/platform-contracts.ts");
	if (!(await fileExists(contractsPath))) {
		report.add("MISSING: platform-contracts.ts");
	} else {
		const contractsSource = await readText(contractsPath);
		for (const requiredType of ["AeoMetadata", "FaqItem", "HowToStep"]) {
			if (!contractsSource.includes(`export interface ${requiredType}`)) {
				report.add(
					`MISSING TYPE: ${requiredType} not exported from platform-contracts.ts`,
				);
			}
		}
	}

	if (!report.failed) {
		console.log(
			`  Components audited: ${requiredComponents.length + 1} (${requiredComponents.map((c) => c.name).join(", ")}, ${contentLayoutComponent.name})`,
		);
		console.log("  Open Graph + canonical: AstropressSeoHead.astro ✓");
		console.log("  sitemap.xml ✓  llms.txt ✓  DonateAction ✓");
		console.log("  AeoMetadata types: FaqItem, HowToStep, AeoMetadata ✓");
	}

	report.finish("✓ audit:aeo — all AEO/SEO components present and structurally valid");
}

runAudit("aeo", main);
