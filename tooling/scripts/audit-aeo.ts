/**
 * audit-aeo.ts
 *
 * Verifies that all five AEO JSON-LD Astro components exist and export valid component content.
 * Run via: bun run audit:aeo
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
	console.log(
		"✓ audit:aeo — all AEO JSON-LD components present and structurally valid",
	);
	console.log(
		`  Components audited: ${requiredComponents.length + 1} (${requiredComponents.map((c) => c.name).join(", ")}, ${contentLayoutComponent.name})`,
	);
	console.log("  AeoMetadata types: FaqItem, HowToStep, AeoMetadata ✓");
} else {
	console.error("✗ audit:aeo — AEO component audit FAILED:");
	for (const failure of failures) {
		console.error(`  ${failure}`);
	}
}

process.exit(exitCode);
