#!/usr/bin/env bun
/**
 * audit-mutation-blindspots — surface where the per-file mutation gate is
 * structurally blind:
 *   1. ignoreStatic dropped mutants  — counted from stryker config flag and
 *      flagged as a known scope reduction.
 *   2. high-blast-radius tests       — entries on the audit-test-fanout
 *      allowlist (a test-file edit silently re-runs all touched src files).
 *   3. baseline floor accept band    — number of files locked in below 95
 *      (the ratchet is upward-only; floors never raise themselves).
 *
 * Discovery only; no rerun.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STRYKER_CFG = "tooling/stryker/stryker.config.mjs";
const BASELINE = "tooling/stryker/baseline-scores.json";
const FANOUT = "tooling/scripts/audit-test-fanout.ts";
const OUT = "tooling/audit-output/mutation-blindspots.json";

const cfg = readFileSync(STRYKER_CFG, "utf8");
const ignoreStatic = /ignoreStatic:\s*true/.test(cfg);

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {
	scores: Record<string, { score: number }>;
};

const buckets = { lt80: 0, lt90: 0, lt95: 0, eq100: 0, ge95Lt100: 0, total: 0 };
const lockedBelow95: { file: string; score: number }[] = [];
for (const [file, v] of Object.entries(baseline.scores)) {
	buckets.total++;
	if (v.score === 100) buckets.eq100++;
	else if (v.score >= 95) buckets.ge95Lt100++;
	if (v.score < 80) buckets.lt80++;
	else if (v.score < 90) buckets.lt90++;
	else if (v.score < 95) {
		buckets.lt95++;
		lockedBelow95.push({ file, score: v.score });
	}
}
lockedBelow95.sort((a, b) => a.score - b.score);

// Fanout allowlist
let fanoutAllowlist: string[] = [];
try {
	const f = readFileSync(FANOUT, "utf8");
	const allowMap = f.match(/ALLOWLIST[\s\S]*?new Map\(\[([\s\S]*?)\]\);/);
	if (allowMap) {
		fanoutAllowlist = [...allowMap[1].matchAll(/"([^"]+\.test\.ts)"/g)].map((m) => m[1]);
	}
} catch {}

const report = {
	generatedAt: new Date().toISOString(),
	strykerConfig: { ignoreStatic },
	baselineDistribution: buckets,
	filesLockedBelow95Count: lockedBelow95.length,
	filesLockedBelow95: lockedBelow95.slice(0, 40),
	highFanoutAllowlistCount: fanoutAllowlist.length,
	highFanoutAllowlist: fanoutAllowlist,
	notes: [
		ignoreStatic
			? "ignoreStatic=true — mutants on top-level constants and default-arg literals NEVER counted."
			: "ignoreStatic=false (uncommon).",
		`${buckets.lt80 + buckets.lt90 + buckets.lt95}/${buckets.total} baseline files below 95%; floor only ratchets up, never sweeps these.`,
	],
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`mutation-blindspots: ignoreStatic=${ignoreStatic} below95=${lockedBelow95.length}/${buckets.total} fanoutAllowlist=${fanoutAllowlist.length}`,
);
