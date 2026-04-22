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

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const componentsRoot = path.resolve(
	import.meta.dirname,
	"../../packages/astropress/components",
);
const pagesRoot = path.resolve(import.meta.dirname, "../../packages/astropress/pages");
const srcRoot = path.resolve(import.meta.dirname, "../../packages/astropress/src");

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

let exitCode = 0;
const failures: string[] = [];

function auditComponent(name: string, file: string, checks: string[]): void {
	const fullPath = path.join(componentsRoot, file);
	if (!existsSync(fullPath)) {
		failures.push(`MISSING: ${name} (${file})`);
		exitCode = 1;
		return;
	}

	const source = readFileSync(fullPath, "utf8");
	for (const check of checks) {
		if (!source.includes(check)) {
			failures.push(
				`MALFORMED: ${name} (${file}) — missing required string "${check}"`,
			);
			exitCode = 1;
		}
	}
}

// Audit the five core AEO JSON-LD components
for (const component of requiredComponents) {
	auditComponent(component.name, component.file, component.checks);
}

// Audit the content layout auto-wiring component
auditComponent(
	contentLayoutComponent.name,
	contentLayoutComponent.file,
	contentLayoutComponent.checks,
);

// ── Open Graph + canonical: AstropressSeoHead.astro ──
const seoHeadPath = path.join(componentsRoot, "AstropressSeoHead.astro");
if (!existsSync(seoHeadPath)) {
  failures.push("MISSING: AstropressSeoHead.astro — Open Graph and canonical tags required");
  exitCode = 1;
} else {
  const seoSrc = readFileSync(seoHeadPath, "utf8");
  for (const token of ["og:title", "og:description", "canonical"]) {
    if (!seoSrc.includes(token)) {
      failures.push(`MALFORMED: AstropressSeoHead.astro — missing "${token}"`);
      exitCode = 1;
    }
  }
}

// ── sitemap.xml endpoint ──
const sitemapPath = path.join(pagesRoot, "sitemap.xml.ts");
if (!existsSync(sitemapPath)) {
  failures.push("MISSING: pages/sitemap.xml.ts — sitemap.xml endpoint required for AEO");
  exitCode = 1;
}

// ── llms.txt endpoint (AI crawlers) ──
// May be .ts or .js (compiled output served alongside source)
const llmsTsPath = path.join(pagesRoot, "llms.txt.ts");
const llmsJsPath = path.join(pagesRoot, "llms.txt.js");
if (!existsSync(llmsTsPath) && !existsSync(llmsJsPath)) {
  failures.push("MISSING: pages/llms.txt.ts — llms.txt endpoint required for AI crawler AEO");
  exitCode = 1;
}

// ── DonateAction JSON-LD in donations.ts ──
const donationsPath = path.join(srcRoot, "donations.ts");
if (!existsSync(donationsPath)) {
  failures.push("MISSING: src/donations.ts — DonateAction JSON-LD generator required");
  exitCode = 1;
} else {
  const donationsSrc = readFileSync(donationsPath, "utf8");
  if (!donationsSrc.includes("DonateAction")) {
    failures.push('MALFORMED: src/donations.ts — missing "DonateAction" schema.org type');
    exitCode = 1;
  }
}

// Verify AeoMetadata types are exported from platform-contracts
const contractsPath = path.resolve(
	import.meta.dirname,
	"../../packages/astropress/src/platform-contracts.ts",
);
if (!existsSync(contractsPath)) {
	failures.push("MISSING: platform-contracts.ts");
	exitCode = 1;
} else {
	const contractsSource = readFileSync(contractsPath, "utf8");
	for (const requiredType of ["AeoMetadata", "FaqItem", "HowToStep"]) {
		if (!contractsSource.includes(`export interface ${requiredType}`)) {
			failures.push(
				`MISSING TYPE: ${requiredType} not exported from platform-contracts.ts`,
			);
			exitCode = 1;
		}
	}
}

if (failures.length === 0) {
	console.log("✓ audit:aeo — all AEO/SEO components present and structurally valid");
	console.log(
		`  Components audited: ${requiredComponents.length + 1} (${requiredComponents.map((c) => c.name).join(", ")}, ${contentLayoutComponent.name})`,
	);
	console.log("  Open Graph + canonical: AstropressSeoHead.astro ✓");
	console.log("  sitemap.xml ✓  llms.txt ✓  DonateAction ✓");
	console.log("  AeoMetadata types: FaqItem, HowToStep, AeoMetadata ✓");
} else {
	console.error("✗ audit:aeo — AEO component audit FAILED:");
	for (const failure of failures) {
		console.error(`  ${failure}`);
	}
}

process.exit(exitCode);
