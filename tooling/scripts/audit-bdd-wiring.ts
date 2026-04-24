import { join, relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

// New audit: BDD Feature File Wiring
//
// Verifies that the BDD test framework has real, non-stub coverage for every
// feature scenario in tooling/bdd/**/*.feature:
//
//   1. Every Scenario: line in every .feature file has its exact text present
//      in tooling/scripts/bdd-test.ts (wired to a VerificationGroup)
//
//   2. Every VerificationGroup in bdd-test.ts has at least one step in its
//      `steps` array (no empty/stub groups that claim coverage but run nothing)
//
//   3. Every test file referenced in bdd-test.ts vitest steps actually exists
//      on disk (prevents wiring to deleted test files)

const BDD_ROOT = fromRoot("tooling/bdd");
const BDD_TEST_TS = fromRoot("tooling/scripts/bdd-test.ts");
const ASTROPRESS_PKG = fromRoot("packages/astropress");
const NEXUS_PKG = fromRoot("packages/astropress-nexus");

async function main() {
	const report = new AuditReport("bdd-wiring");
	const bddTestSrc = await readText(BDD_TEST_TS);
	const featureEntries = await listFiles(BDD_ROOT, {
		recursive: true,
		extensions: [".feature"],
	});
	const featureFiles = featureEntries.map((e) => join(BDD_ROOT, e)).sort();

	// ── Check 1: every scenario is wired ────────────────────────────────────────
	let totalScenarios = 0;

	for (const featurePath of featureFiles) {
		const relPath = relative(ROOT, featurePath);
		const src = await readText(featurePath);
		for (const line of src.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("Scenario:")) continue;
			const scenarioText = trimmed.slice("Scenario:".length).trim();
			totalScenarios++;

			// Also try the escaped-quotes form: `"c"` in a .feature file appears as `\"c\"` in bdd-test.ts
			const escapedScenarioText = scenarioText.replaceAll('"', '\\"');
			if (
				!bddTestSrc.includes(scenarioText) &&
				!bddTestSrc.includes(escapedScenarioText)
			) {
				report.add(
					`[unwired scenario] "${scenarioText}" — in ${relPath} but not found in bdd-test.ts`,
				);
			}
		}
	}

	// ── Check 2: no empty verification groups ───────────────────────────────────
	const emptyStepsPattern = /steps\s*:\s*\[\s*\]/g;
	for (const m of bddTestSrc.matchAll(emptyStepsPattern)) {
		const before = bddTestSrc.slice(0, m.index);
		const labelMatch = before.match(/label\s*:\s*["']([^"']+)["'][^{]*$/);
		const groupLabel = labelMatch ? labelMatch[1] : "(unknown group)";
		report.add(
			`[empty verification group] "${groupLabel}" — has an empty steps: [] array. Add at least one test step.`,
		);
	}

	// ── Check 3: all referenced vitest test files exist ─────────────────────────
	const vitestFilePattern = /"tests\/([^"]+\.test\.ts)"/g;

	for (const m of bddTestSrc.matchAll(vitestFilePattern)) {
		const testRelPath = m[1];
		const matchPos = m.index ?? 0;

		const context = bddTestSrc.slice(
			Math.max(0, matchPos - 500),
			matchPos + 200,
		);
		const isNexusTest =
			context.includes("nexusPackageRoot") || context.includes("nexus");

		const resolvedPath = isNexusTest
			? join(NEXUS_PKG, "tests", testRelPath)
			: join(ASTROPRESS_PKG, "tests", testRelPath);

		if (!(await fileExists(resolvedPath))) {
			const rel = relative(ROOT, resolvedPath);
			report.add(
				`[missing test file] ${rel} — referenced in bdd-test.ts but does not exist on disk`,
			);
		}
	}

	report.finish(
		`bdd-wiring audit passed — ${totalScenarios} scenarios across ${featureFiles.length} feature files: all wired, no empty groups, all referenced test files exist.`,
	);
}

runAudit("bdd-wiring", main);
