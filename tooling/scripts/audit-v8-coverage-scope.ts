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

const includedSet = new Set(included);
const baselineSet = new Set(baselineFiles);
const baselineNotIncluded = baselineFiles.filter((p) => !includedSet.has(p));
const includedNotBaseline = included.filter((p) => !baselineSet.has(p));

// "False confidence" candidates: in baseline at >=95 but NOT in coverage.include.
const falseConfidence = Object.entries(baseline.scores)
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
