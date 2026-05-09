#!/usr/bin/env bun
/**
 * raise-baseline — run Stryker on one or more specified TypeScript src
 * files and rewrite their entries in tooling/stryker/baseline-scores.json
 * with the fresh score + git hash. Used for Phase 2 work where we
 * intentionally re-score files whose content has not changed against
 * origin/main (so prepush-mutation-gate's content-hash skip would
 * otherwise reuse the old score).
 *
 * Usage:
 *   bun run tooling/scripts/raise-baseline.ts \
 *     packages/astropress/src/admin-slug-cache.ts [more files...]
 *
 * Per-file score formula matches prepush-mutation-gate (ignores Static,
 * Ignored, NoCoverage). On any score < 95 the file is left in baseline
 * with its newly-measured score; the operator can iterate.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isEquivalentMutant, loadEquivalentMutants } from "./equivalent-mutants";

const PREFIX = "packages/astropress/";
// Anchor every disk path to `git rev-parse --show-toplevel` so the script is
// safe to run from any cwd (otherwise BASELINE_PATH and the stryker config
// resolve relative to whatever subdirectory invoked the script).
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	encoding: "utf8",
}).trim();
const BASELINE_PATH = join(REPO_ROOT, "tooling/stryker/baseline-scores.json");

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

interface StrykerReportMutant {
	status: string;
	static?: boolean;
	mutatorName?: string;
	location?: { start?: { line?: number; column?: number } };
}
interface StrykerReport {
	files: Record<string, { mutants: StrykerReportMutant[] }>;
}

function gitHashObject(path: string): string {
	return execFileSync("git", ["hash-object", path], {
		encoding: "utf8",
	}).trim();
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) return { updatedAt: "never", scores: {} };
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function saveBaseline(b: Baseline): void {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(b, null, 2)}\n`);
	// Pipe through biome so the on-disk shape always matches the formatter's
	// current opinion. Without this every commit needs `biome --write` first;
	// pre-commit's biome hook would still catch it but the developer wastes a
	// round trip. `--no-errors-on-unmatched` keeps the call quiet if biome
	// happens to be configured to skip JSON in some future config.
	const result = spawnSync(
		"bunx",
		["@biomejs/biome", "format", "--write", "--no-errors-on-unmatched", BASELINE_PATH],
		{ stdio: "inherit", cwd: REPO_ROOT },
	);
	if (result.status !== 0) {
		throw new Error(
			`raise-baseline: biome format failed for ${BASELINE_PATH} (exit ${result.status}).`,
		);
	}
}

function scoreForFile(report: StrykerReport, relMutate: string): number | null {
	const key = Object.keys(report.files).find((k) => k.endsWith(relMutate));
	if (!key) return null;
	const mutants = report.files[key].mutants;
	const equivalents = loadEquivalentMutants();
	const isExcluded = (m: StrykerReportMutant): boolean =>
		m.status === "Ignored" || m.status === "NoCoverage" || isEquivalentMutant(key, m, equivalents);
	const scored = mutants.filter((m) => !isExcluded(m));
	if (scored.length === 0) return 100;
	const killed = scored.filter((m) => m.status === "Killed" || m.status === "Timeout");
	return (killed.length / scored.length) * 100;
}

function runStryker(targets: string[], tmp: string, fast = false): StrykerReport | null {
	const configPath = join(tmp, "stryker.config.mjs");
	const reportPath = join(tmp, "report.json");
	// In fast mode coverage analysis is disabled and we trust vitest's
	// `related: true` filter to only run tests that import the mutated file.
	// Skipping perTest coverage analysis avoids the upfront vitest run that
	// otherwise dominates wall-clock for files with focused unit tests.
	const coverageAnalysis = fast ? "off" : "perTest";
	writeFileSync(
		configPath,
		`export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ${JSON.stringify(targets)},
  testRunner: "vitest",
  coverageAnalysis: ${JSON.stringify(coverageAnalysis)},
  vitest: { related: true },
  ignoreStatic: false,
  concurrency: 4,
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: ${JSON.stringify(reportPath)} },
  timeoutMS: 15000,
  thresholds: { high: 95, low: 95, break: 0 },
};
`,
	);
	const strykerBin = join(REPO_ROOT, "node_modules/.bin/stryker");
	spawnSync("node", [strykerBin, "run", configPath], {
		cwd: join(REPO_ROOT, "packages/astropress"),
		stdio: "inherit",
	});
	if (!existsSync(reportPath)) return null;
	return JSON.parse(readFileSync(reportPath, "utf8")) as StrykerReport;
}

function main(): number {
	const rawArgv = process.argv.slice(2);
	const fast = rawArgv.includes("--fast");
	const argv = rawArgv.filter((a) => a !== "--fast");
	if (argv.length === 0) {
		console.error("Usage: raise-baseline [--fast] <file> [more files...]");
		return 1;
	}
	for (const f of argv) {
		if (!f.startsWith(PREFIX)) {
			console.error(`raise-baseline: ${f} does not start with ${PREFIX}`);
			return 1;
		}
		if (!existsSync(f)) {
			console.error(`raise-baseline: missing ${f}`);
			return 1;
		}
	}
	const baseline = loadBaseline();
	const tmp = mkdtempSync(join(tmpdir(), "stryker-raise-"));
	try {
		const targets = argv.map((f) => f.slice(PREFIX.length));
		console.log(`raise-baseline: running Stryker on ${targets.length} file(s)...`);
		const report = runStryker(targets, tmp, fast);
		if (!report) {
			console.error("raise-baseline: Stryker produced no JSON report");
			return 1;
		}
		console.log("\nResults:");
		for (const f of argv) {
			const relMutate = f.slice(PREFIX.length);
			const score = scoreForFile(report, relMutate);
			const hash = gitHashObject(f);
			if (score === null) {
				console.error(`  ✖ ${f}: no score (file not in report)`);
				continue;
			}
			const prev = baseline.scores[f];
			const arrow = prev ? `${prev.score.toFixed(2)}% → ` : "";
			const ok = score >= 95;
			console.log(`  ${ok ? "✓" : "•"} ${f}: ${arrow}${score.toFixed(2)}%`);
			baseline.scores[f] = { score, hash };
		}
		baseline.updatedAt = new Date().toISOString();
		saveBaseline(baseline);
		console.log(`\nBaseline rewritten at ${BASELINE_PATH}.`);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
	return 0;
}

process.exit(main());
