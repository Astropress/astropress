#!/usr/bin/env bun
/**
 * audit-v8-coverage-scope — diff vitest coverage.include vs the set of src
 * files tracked by stryker baseline. Surfaces files mutation-passing but
 * never measured by v8 (branches that never execute in any test produce no
 * mutants, so mutation alone misses them).
 *
 * Discovery only.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const VITEST = "packages/astropress/vitest.config.ts";
const BASELINE = "tooling/stryker/baseline-scores.json";
const OUT = "tooling/audit-output/v8-coverage-scope.json";

function readCoverageInclude(): string[] {
	const src = readFileSync(VITEST, "utf8");
	// Find the coverage block first, then extract its include array.
	const cov = src.match(/coverage:\s*\{[\s\S]*?\n\t\t\}/);
	if (!cov) return [];
	const block = cov[0].match(/include:\s*\[([\s\S]*?)\]/);
	if (!block) return [];
	return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
}

const included = readCoverageInclude();
const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {
	scores: Record<string, { score: number }>;
};
const baselineFiles = Object.keys(baseline.scores)
	.filter((p) => p.startsWith("packages/astropress/src/"))
	.map((p) => p.slice("packages/astropress/".length))
	.sort();

// Treat the broad glob "src/**/*.ts" as covering every src file. The
// gate exists to prevent silently narrowing the include list back to a
// per-file allowlist that excludes baseline-tracked code.
const includedGlob = included.some((p) => p === "src/**/*.ts");
const includedSet = new Set(included);
const baselineSet = new Set(baselineFiles);
const baselineNotIncluded = includedGlob ? [] : baselineFiles.filter((p) => !includedSet.has(p));
const includedNotBaseline = includedGlob ? [] : included.filter((p) => !baselineSet.has(p));

const falseConfidence = includedGlob
	? []
	: Object.entries(baseline.scores)
			.filter(([p, v]) => p.startsWith("packages/astropress/src/") && v.score >= 95)
			.map(([p]) => p.slice("packages/astropress/".length))
			.filter((p) => !includedSet.has(p))
			.sort();

const report = {
	generatedAt: new Date().toISOString(),
	coverageIncludedCount: included.length,
	baselineTrackedCount: baselineFiles.length,
	baselineNotInCoverageIncludeCount: baselineNotIncluded.length,
	includedButNotInBaselineCount: includedNotBaseline.length,
	falseConfidenceCount: falseConfidence.length,
	baselineNotInCoverageInclude: baselineNotIncluded,
	includedButNotInBaseline: includedNotBaseline,
	falseConfidenceFiles: falseConfidence,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`v8-coverage-scope: included=${included.length} baseline=${baselineFiles.length} unmeasured=${baselineNotIncluded.length} falseConfidence>=95=${falseConfidence.length}`,
);

// Gate: any baseline file unmeasured by v8 is the false-confidence channel
// the discovery audit flagged. Either broaden coverage.include (preferred —
// use "src/**/*.ts") or remove the file from the mutation baseline if it
// truly should not be tested.
if (falseConfidence.length > 0 || baselineNotIncluded.length > 0) {
	console.error(
		`v8-coverage-scope FAIL: ${baselineNotIncluded.length} baseline file(s) outside coverage.include, ${falseConfidence.length} of those mutation>=95 (false confidence).`,
	);
	for (const p of falseConfidence.slice(0, 20)) console.error(`  false-confidence: ${p}`);
	if (falseConfidence.length > 20) console.error(`  ... and ${falseConfidence.length - 20} more`);
	console.error('\nFix: set vitest.config.ts coverage.include to ["src/**/*.ts"].');
	process.exit(1);
}
