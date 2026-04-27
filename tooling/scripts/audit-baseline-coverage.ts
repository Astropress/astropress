#!/usr/bin/env bun
/**
 * audit-baseline-coverage — assert every mutation-eligible src file has a
 * baseline entry in tooling/stryker/baseline-scores.json.
 *
 * Why this exists
 * ---------------
 * On 2026-04-25 the prepush-mutation-gate landed in PR #61 along with an
 * initial baseline-scores.json that only covered files that PR touched. Every
 * other file on main was implicitly classified as "no baseline = treat as new
 * = 95% floor on next edit." A 200-file historical population was silently
 * gated against a floor that punished any future small refactor.
 *
 * This audit closes that gap forward: any new src/*.ts file lands together
 * with its baseline entry, captured at creation time. The retro-baseline
 * backfill (tooling/scripts/backfill-baseline-scores.ts) handles the
 * historical population once.
 *
 * Mutation eligibility mirrors stryker.config.mjs `mutate:` minus the same
 * exclusions (.d.ts, index.ts, persistence-types.ts, config-service-types.ts).
 *
 * Failure mode
 * ------------
 * Lists every src file missing from baseline-scores.json with the command to
 * run to populate it.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = "packages/astropress/src";
const BASELINE_PATH = "tooling/stryker/baseline-scores.json";

const EXCLUDE_FILE_PATTERNS: ((path: string) => boolean)[] = [
	(p) => p.endsWith(".d.ts"),
	(p) => p.endsWith("/index.ts"),
	(p) => p === `${SRC_ROOT}/persistence-types.ts`,
	(p) => p === `${SRC_ROOT}/config-service-types.ts`,
];

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

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
	if (!existsSync(SRC_ROOT)) {
		console.error(`audit-baseline-coverage: missing ${SRC_ROOT}`);
		process.exit(1);
	}
	const root = process.cwd();
	const all = walk(SRC_ROOT).map((p) => relative(root, p));
	return all.filter((p) => !EXCLUDE_FILE_PATTERNS.some((m) => m(p))).sort();
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) {
		return { updatedAt: "never", scores: {} };
	}
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
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

function main(): number {
	const eligible = eligibleSrcFiles();
	const baseline = loadBaseline();

	const missing: string[] = [];
	const stale: { file: string; baselineHash: string; currentHash: string }[] =
		[];

	for (const file of eligible) {
		const entry = baseline.scores[file];
		if (!entry) {
			missing.push(file);
			continue;
		}
		const currentHash = gitHashObject(file);
		if (currentHash && entry.hash !== currentHash) {
			// Hash drift is a soft signal — the prepush-mutation-gate catches it
			// for changed files vs origin/main. We just count for visibility.
			stale.push({ file, baselineHash: entry.hash, currentHash });
		}
	}

	const orphans = Object.keys(baseline.scores).filter(
		(f) => !eligible.includes(f) && existsSync(f) === false,
	);

	if (missing.length === 0 && orphans.length === 0) {
		console.log(
			`audit-baseline-coverage passed — ${eligible.length} mutation-eligible src files, all in ${BASELINE_PATH}${
				stale.length > 0
					? ` (${stale.length} hash-drifted; gate will re-score on push)`
					: ""
			}.`,
		);
		return 0;
	}

	console.error("\n✖ audit-baseline-coverage FAILED:\n");
	if (missing.length > 0) {
		console.error(
			`  ${missing.length} src file(s) missing from ${BASELINE_PATH}:`,
		);
		for (const f of missing.slice(0, 20)) console.error(`    ${f}`);
		if (missing.length > 20)
			console.error(`    ... and ${missing.length - 20} more`);
		console.error(
			"\n  Populate via: bun run tooling/scripts/backfill-baseline-scores.ts",
		);
	}
	if (orphans.length > 0) {
		console.error(
			`\n  ${orphans.length} baseline entries point to deleted files:`,
		);
		for (const f of orphans) console.error(`    ${f}`);
		console.error(
			"\n  Remove orphans by re-running backfill-baseline-scores.ts (it prunes deleted files).",
		);
	}
	return 1;
}

process.exit(main());
