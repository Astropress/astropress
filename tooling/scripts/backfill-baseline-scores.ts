#!/usr/bin/env bun
/**
 * backfill-baseline-scores — populate tooling/stryker/baseline-scores.json
 * with an entry for every mutation-eligible src/*.ts file.
 *
 * Reads reports/mutation/report.json (produced by `bun run test:mutants`),
 * computes each file's mutation score, captures its current git-blob hash,
 * merges into baseline-scores.json. Entries for files that no longer exist
 * are pruned.
 *
 * Workflow
 * --------
 *   bun run test:mutants                          # 30min – several hours
 *   bun run tooling/scripts/backfill-baseline-scores.ts
 *   git add tooling/stryker/baseline-scores.json
 *   git commit -m "chore(stryker): retro-baseline …"
 *
 * Why this exists
 * ---------------
 * The prepush-mutation-gate's "no baseline entry = 95% floor" rule fires on
 * every untouched-by-PR-#61 file the moment someone edits it. With ~200 such
 * files on main, every routine refactor became an unrelated test-writing
 * exercise. Backfilling once captures each file's current score as its
 * floor; the gate's existing "regression beyond −0.5%" rule then does the
 * right thing on subsequent edits.
 *
 * The audit `audit-baseline-coverage` enforces that this never happens
 * again — every new src file must land with a baseline entry.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPORT_PATH = "reports/mutation/report.json";
const BASELINE_PATH = "tooling/stryker/baseline-scores.json";
const SRC_PREFIX = "packages/astropress/src/";
const SRC_ROOT = "packages/astropress/src";

const EXCLUDE_FILE_PATTERNS: ((path: string) => boolean)[] = [
	(p) => p.endsWith(".d.ts"),
	(p) => p.endsWith("/index.ts"),
	(p) => p === `${SRC_ROOT}/persistence-types.ts`,
	(p) => p === `${SRC_ROOT}/config-service-types.ts`,
];

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...walk(full));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function eligibleSrcFiles(): string[] {
	const root = process.cwd();
	return walk(SRC_ROOT)
		.map((p) => relative(root, p))
		.filter((p) => !EXCLUDE_FILE_PATTERNS.some((m) => m(p)))
		.sort();
}

interface MutantStatus {
	status: string;
}
interface StrykerReport {
	files: Record<string, { mutants: MutantStatus[] }>;
}

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

function loadReport(): StrykerReport {
	if (!existsSync(REPORT_PATH)) {
		console.error(
			`backfill-baseline-scores: missing ${REPORT_PATH}\n  Run \`bun run test:mutants\` first to produce the report.`,
		);
		process.exit(1);
	}
	return JSON.parse(readFileSync(REPORT_PATH, "utf8")) as StrykerReport;
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) {
		return { updatedAt: "never", scores: {} };
	}
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function saveBaseline(b: Baseline): void {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(b, null, 2)}\n`);
}

function gitHashObject(path: string): string | null {
	try {
		return execFileSync("git", ["hash-object", path], {
			encoding: "utf8",
		}).trim();
	} catch {
		return null;
	}
}

function scoreFromMutants(mutants: MutantStatus[]): number {
	const scored = mutants.filter(
		(m) => m.status !== "Ignored" && m.status !== "NoCoverage",
	);
	if (scored.length === 0) return 100;
	const killed = mutants.filter(
		(m) => m.status === "Killed" || m.status === "Timeout",
	);
	return (killed.length / scored.length) * 100;
}

/**
 * Stryker's report keys are absolute paths run-from packages/astropress/.
 * Convert to repo-relative paths matching baseline-scores.json convention
 * (e.g. "packages/astropress/src/foo.ts").
 */
function reportKeyToBaselineKey(key: string): string | null {
	if (key.startsWith("src/")) {
		return SRC_PREFIX + key.slice("src/".length);
	}
	const idx = key.indexOf("/src/");
	if (idx === -1) return null;
	return SRC_PREFIX + key.slice(idx + "/src/".length);
}

function main(): number {
	const report = loadReport();
	const baseline = loadBaseline();

	const nextScores: Record<string, BaselineEntry> = {};
	let added = 0;
	let updated = 0;
	let unchanged = 0;
	let skipped = 0;

	for (const [key, entry] of Object.entries(report.files)) {
		const file = reportKeyToBaselineKey(key);
		if (!file) {
			skipped++;
			continue;
		}
		if (!existsSync(file)) {
			skipped++;
			continue;
		}
		const score = scoreFromMutants(entry.mutants);
		const hash = gitHashObject(file);
		if (hash === null) {
			skipped++;
			continue;
		}
		const prev = baseline.scores[file];
		if (!prev) {
			added++;
		} else if (prev.score !== score || prev.hash !== hash) {
			updated++;
		} else {
			unchanged++;
		}
		nextScores[file] = { score, hash };
	}

	// Files Stryker excluded entirely (type-only, barrel re-exports — 0 mutants
	// generated) won't appear in the report. Record them with score 100 so the
	// audit doesn't flag them as missing baseline coverage.
	let trivial = 0;
	for (const file of eligibleSrcFiles()) {
		if (nextScores[file]) continue;
		const hash = gitHashObject(file);
		if (hash === null) continue;
		const prev = baseline.scores[file];
		if (!prev) {
			added++;
		} else if (prev.score !== 100 || prev.hash !== hash) {
			updated++;
		} else {
			unchanged++;
		}
		nextScores[file] = { score: 100, hash };
		trivial++;
	}

	// Detect orphans (entries pointing at deleted files) and drop them.
	const orphans: string[] = [];
	for (const file of Object.keys(baseline.scores)) {
		if (!nextScores[file] && !existsSync(file)) {
			orphans.push(file);
		} else if (!nextScores[file] && existsSync(file)) {
			// File exists but not in the report — likely excluded by stryker
			// config (e.g. *.d.ts). Preserve its entry.
			nextScores[file] = baseline.scores[file];
			unchanged++;
		}
	}

	saveBaseline({
		updatedAt: new Date().toISOString(),
		scores: nextScores,
	});

	console.log(
		`backfill-baseline-scores: processed ${Object.keys(report.files).length} report entries\n` +
			`  added: ${added}\n` +
			`  updated: ${updated}\n` +
			`  unchanged: ${unchanged}\n` +
			`  trivial (no-mutant files marked score=100): ${trivial}\n` +
			`  orphans pruned: ${orphans.length}\n` +
			`  skipped (non-src or deleted): ${skipped}\n\n` +
			`Baseline written to ${BASELINE_PATH} — review the diff and commit.`,
	);
	if (orphans.length > 0) {
		console.log("Pruned entries (file no longer exists):");
		for (const o of orphans) console.log(`  - ${o}`);
	}
	return 0;
}

process.exit(main());
