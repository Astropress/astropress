#!/usr/bin/env bun
/**
 * audit-coverage-floor — block commits that lower per-file v8 coverage.
 *
 * Mirrors audit-baseline-floor.ts: every TypeScript src file in vitest's
 * coverage.include glob is required to stay at-or-above its recorded
 * lines/branches/functions percentages. New files must land at >= FLOOR
 * for all three metrics. Drops are rejected with a recovery hint.
 *
 * Why
 * ---
 * The mutation gate scores killed mutants per file but cannot detect
 * untested *branches* (a branch with no executing test produces no
 * mutants). The v8 line/branch/function metric is the missing dimension.
 * Without a per-file ratchet, broadening coverage.include silently dilutes
 * aggregate percentages on every PR.
 *
 * Workflow
 * --------
 *   bun run --filter @astropress-diy/astropress test:coverage  # produces coverage-summary.json
 *   bun run tooling/scripts/audit-coverage-floor.ts            # gate
 *   bun run tooling/scripts/audit-coverage-floor.ts --rewrite-baseline  # ratchet up
 *
 * The rewrite mode is for one-shot sweeps after intentionally raising
 * tests on a file; it captures the new floor. Routine commits should NOT
 * use --rewrite-baseline; the gate's safety guarantee depends on baselines
 * only moving up.
 *
 * Exit code: 0 on pass, 1 on any blocked transition.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SUMMARY_PATH = "packages/astropress/coverage/coverage-summary.json";
const BASELINE_PATH = "tooling/audit-output/coverage-floor-baseline.json";
const FLOOR = 95;
const TOLERANCE = 0.5;

interface CoverageMetric {
	pct: number;
}
interface CoverageEntry {
	lines: CoverageMetric;
	branches: CoverageMetric;
	functions: CoverageMetric;
	statements: CoverageMetric;
}
type CoverageSummary = Record<string, CoverageEntry> & {
	total?: CoverageEntry;
};

interface BaselineEntry {
	lines: number;
	branches: number;
	functions: number;
}
interface Baseline {
	updatedAt: string;
	note: string;
	floor: number;
	scores: Record<string, BaselineEntry>;
}

function loadSummary(): CoverageSummary | null {
	if (!existsSync(SUMMARY_PATH)) return null;
	return JSON.parse(readFileSync(SUMMARY_PATH, "utf8")) as CoverageSummary;
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) {
		return {
			updatedAt: "never",
			note: "Per-file v8 coverage floor — counts may move up, never down. Run --rewrite-baseline after intentionally raising tests.",
			floor: FLOOR,
			scores: {},
		};
	}
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function saveBaseline(b: Baseline): void {
	if (!existsSync(dirname(BASELINE_PATH))) {
		mkdirSync(dirname(BASELINE_PATH), { recursive: true });
	}
	writeFileSync(BASELINE_PATH, `${JSON.stringify(b, null, 2)}\n`);
}

function relativise(path: string): string {
	const cwd = process.cwd();
	if (path.startsWith(cwd)) return path.slice(cwd.length + 1);
	return path;
}

function entryFromSummary(e: CoverageEntry): BaselineEntry {
	return {
		lines: e.lines.pct,
		branches: e.branches.pct,
		functions: e.functions.pct,
	};
}

function isSrcFile(rel: string): boolean {
	if (
		!(
			rel.startsWith("packages/astropress/src/") &&
			rel.endsWith(".ts") &&
			!rel.endsWith(".d.ts") &&
			!rel.endsWith("/local-runtime-modules.ts") &&
			!rel.includes("/client/") &&
			!/cloudflare-.*-stub/.test(rel)
		)
	) {
		return false;
	}
	// Honor the data-only marker (mirrors audit-error-handling.ts and the
	// mutation gate). Pure-data sibling files (`*-data.ts`,
	// `*-error-shapes.ts`, `*-seed-data.ts`, `*-defaults.ts`) carry no
	// executable logic worth coverage-measuring; including them dilutes
	// real-coverage signal for the parent file.
	if (!existsSync(rel)) return true;
	const head = readFileSync(rel, "utf8").split("\n", 10).join("\n");
	if (/stryker-disable-file:\s*data-only/.test(head)) return false;
	return true;
}

function gatherCurrent(summary: CoverageSummary): Map<string, BaselineEntry> {
	const out = new Map<string, BaselineEntry>();
	for (const [path, entry] of Object.entries(summary)) {
		if (path === "total") continue;
		const rel = relativise(path);
		if (!isSrcFile(rel)) continue;
		out.set(rel, entryFromSummary(entry));
	}
	return out;
}

function main(): number {
	const summary = loadSummary();
	if (!summary) {
		console.error(
			`audit-coverage-floor: ${SUMMARY_PATH} not found. Run \`bun run --filter @astropress-diy/astropress test:coverage\` first.`,
		);
		return 1;
	}

	const current = gatherCurrent(summary);
	const baseline = loadBaseline();
	const baselineScores = baseline.scores;

	if (process.argv.includes("--rewrite-baseline")) {
		const next: Baseline = {
			updatedAt: new Date().toISOString(),
			note: baseline.note,
			floor: FLOOR,
			scores: Object.fromEntries(
				[...current.entries()].sort((a, b) => a[0].localeCompare(b[0])),
			),
		};
		saveBaseline(next);
		const aboveFloor = [...current.values()].filter(
			(v) => v.lines >= FLOOR && v.branches >= FLOOR && v.functions >= FLOOR,
		).length;
		console.log(
			`audit-coverage-floor: rewrote baseline (${current.size} files, ${aboveFloor} >= ${FLOOR}% all-three).`,
		);
		return 0;
	}

	const drops: Array<{
		file: string;
		metric: "lines" | "branches" | "functions";
		from: number;
		to: number;
	}> = [];
	const newBelowFloor: Array<{
		file: string;
		lines: number;
		branches: number;
		functions: number;
	}> = [];

	for (const [file, e] of current) {
		const prior = baselineScores[file];
		if (!prior) {
			if (e.lines < FLOOR || e.branches < FLOOR || e.functions < FLOOR) {
				newBelowFloor.push({ file, ...e });
			}
			continue;
		}
		for (const m of ["lines", "branches", "functions"] as const) {
			if (e[m] + TOLERANCE < prior[m]) {
				drops.push({ file, metric: m, from: prior[m], to: e[m] });
			}
		}
	}

	if (drops.length === 0 && newBelowFloor.length === 0) {
		console.log(
			`audit-coverage-floor passed — ${current.size} files measured, no per-file regressions, no new files below ${FLOOR}% all-three.`,
		);
		return 0;
	}

	console.error("\n✖ audit-coverage-floor FAILED:\n");
	for (const d of drops) {
		console.error(
			`  REGRESSION  ${d.file} [${d.metric}]: ${d.from.toFixed(2)}% → ${d.to.toFixed(2)}% (Δ ${(d.to - d.from).toFixed(2)}pt)`,
		);
	}
	for (const n of newBelowFloor) {
		console.error(
			`  NEW BELOW FLOOR  ${n.file}: lines ${n.lines.toFixed(2)}% / branches ${n.branches.toFixed(2)}% / functions ${n.functions.toFixed(2)}% (need >= ${FLOOR}% on all three)`,
		);
	}
	console.error(
		`\n  Coverage may move up freely, but never down. New files must hit >= ${FLOOR}% on lines, branches, AND functions.`,
	);
	console.error(
		"  After intentionally raising tests on a file (lifting coverage above the prior baseline): re-run `test:coverage`,",
	);
	console.error(
		"  then `audit-coverage-floor.ts --rewrite-baseline` to ratchet the baseline up to the new floor.",
	);
	console.error(
		"  Do NOT use --rewrite-baseline to accept a regression — fix the missing tests instead.\n",
	);
	return 1;
}

process.exit(main());
