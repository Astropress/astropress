#!/usr/bin/env bun
/**
 * rebaseline-from-progress — capture the scores from the most recent
 * Stryker run as the new baseline.
 *
 * Reads .stryker-incremental.json (Stryker's own per-mutant cache, written
 * after every run with `incremental: true`) and merges per-file scores
 * into tooling/stryker/baseline-scores.json. Pure aggregation — no new
 * mutation run.
 *
 * Use case: a methodology config change (e.g. ignoreStatic, perTest)
 * shifts scores across many files. Re-running the prepush gate against
 * the old baseline reports false-positive regressions. After confirming
 * the deltas are methodology drift (not real coverage loss), run this
 * once to lock in the new floor and continue. Genuine future regressions
 * still trip the gate's TOLERANCE check against the fresh baseline.
 *
 * Usage:
 *   bun run tooling/scripts/rebaseline-from-progress.ts
 *
 * Files whose new score is more than 10pt below the prior baseline are
 * flagged so the operator can audit each one before committing.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const INCREMENTAL_PATH = ".stryker-incremental.json";
const BASELINE_PATH = "tooling/stryker/baseline-scores.json";
const PREFIX = "packages/astropress/";

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

interface IncrementalMutant {
	id: string;
	status: string;
	static?: boolean;
}
interface IncrementalFile {
	mutants: IncrementalMutant[];
}
interface IncrementalCache {
	files: Record<string, IncrementalFile>;
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

function scoreFromMutants(mutants: IncrementalMutant[]): number | null {
	const scoreable = mutants.filter((m) => m.status !== "Ignored" && m.status !== "NoCoverage");
	if (scoreable.length === 0) return null;
	const killed = scoreable.filter((m) => m.status === "Killed" || m.status === "Timeout");
	return (killed.length / scoreable.length) * 100;
}

function readJsonOrNull<T>(path: string): T | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

function main(): number {
	const cache = readJsonOrNull<IncrementalCache>(INCREMENTAL_PATH);
	if (cache === null) {
		console.error(
			`rebaseline-from-progress: missing ${INCREMENTAL_PATH}\n  Run a Stryker pass first.`,
		);
		return 1;
	}

	const baseline: Baseline = readJsonOrNull<Baseline>(BASELINE_PATH) ?? {
		updatedAt: "never",
		scores: {},
	};

	const nextScores: Record<string, BaselineEntry> = { ...baseline.scores };
	const updates: Array<{
		file: string;
		from: number | null;
		to: number;
		delta: number | null;
	}> = [];
	const flags: string[] = [];
	let unscored = 0;

	for (const [stryKey, info] of Object.entries(cache.files)) {
		// Stryker stores keys relative to its cwd (packages/astropress).
		// Convert to repo-relative path.
		const rel = stryKey.startsWith("src/")
			? `${PREFIX}${stryKey}`
			: stryKey.startsWith(PREFIX)
				? stryKey
				: null;
		if (rel === null) continue;
		// scoreFromMutants returns null when no scoreable mutants remain
		// (e.g. all Ignored/NoCoverage/static, or label files with
		// StringLiteral excluded). Treat those as vacuously 100% — there's
		// nothing for tests to kill. The hash still tracks file content,
		// so future edits that introduce real scoreable mutants will
		// re-trigger judgment.
		const rawScore = scoreFromMutants(info.mutants);
		const score = rawScore ?? 100;
		if (rawScore === null) unscored++;
		const hash = gitHashObject(rel);
		if (hash === null) {
			flags.push(`  SKIP   ${rel}: file not under git`);
			continue;
		}
		const prior = nextScores[rel] ?? null;
		const delta = prior ? score - prior.score : null;
		updates.push({ file: rel, from: prior?.score ?? null, to: score, delta });
		if (delta !== null && delta < -10) {
			flags.push(
				`  AUDIT  ${rel}: ${prior?.score.toFixed(2)}% → ${score.toFixed(2)}% (Δ ${delta.toFixed(2)}pt)`,
			);
		}
		nextScores[rel] = { score, hash };
	}

	updates.sort((a, b) => a.file.localeCompare(b.file));
	const changed = updates.filter((u) => u.from === null || Math.abs(u.delta ?? 0) > 0.001);
	console.log(
		`Updates (${updates.length} files seen, ${changed.length} changed, ${unscored} unscored):`,
	);
	for (const u of changed) {
		const fromStr = u.from === null ? "  new" : `${u.from.toFixed(2)}%`;
		const arrow = u.delta === null ? "+" : u.delta >= 0 ? "↑" : "↓";
		console.log(`  ${arrow} ${u.file}  ${fromStr} → ${u.to.toFixed(2)}%`);
	}
	if (flags.length > 0) {
		console.log("\nFlags:");
		for (const f of flags) console.log(f);
	}

	writeFileSync(
		BASELINE_PATH,
		`${JSON.stringify({ updatedAt: new Date().toISOString(), scores: nextScores }, null, 2)}\n`,
	);
	console.log(`\n✓ Rewrote ${BASELINE_PATH} with ${Object.keys(nextScores).length} entries.`);
	return 0;
}

process.exit(main());
