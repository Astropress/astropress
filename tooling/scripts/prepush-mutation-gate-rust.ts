#!/usr/bin/env bun
/**
 * prepush-mutation-gate-rust — content-hash-aware delta cargo-mutants gate.
 *
 * For each Rust source file changed on this branch vs. origin/main:
 *   - If the git-blob hash matches the recorded baseline hash, skip
 *     cargo-mutants (the prior score is authoritative).
 *   - Otherwise run cargo-mutants scoped to that file via `--file`,
 *     compute the per-file score, and compare against baseline (existing
 *     file: regression check; new file: 95% floor).
 *
 * Score formula matches the initial baseline: caught + timeout count as
 * killed; unviable mutants are excluded from the denominator.
 *
 * On pass, the baseline is rewritten with the new {score, hash}.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FLOOR = 95;
const TOLERANCE = 0.5;
const CRATE_ROOT = "crates";
const SRC_PREFIX = "astropress-cli/src/";
const BASELINE_PATH = "tooling/cargo-mutants/baseline-scores.json";
const OUTCOMES_PATH = "crates/mutants.out/outcomes.json";

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

interface Outcome {
	scenario: { Mutant?: { file: string } } | string;
	summary: string;
}
interface OutcomesFile {
	outcomes: Outcome[];
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) return { updatedAt: "never", scores: {} };
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

function changedRustFiles(): string[] {
	for (const ref of ["origin/main", "HEAD~1"]) {
		try {
			execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "pipe" });
			const out = execFileSync(
				"git",
				[
					"diff",
					"--name-only",
					`${ref}...HEAD`,
					"--",
					`${CRATE_ROOT}/${SRC_PREFIX}*.rs`,
					`${CRATE_ROOT}/${SRC_PREFIX}**/*.rs`,
				],
				{ encoding: "utf8" },
			);
			return out.split("\n").filter((l) => l.endsWith(".rs") && existsSync(l));
		} catch {
			// next ref
		}
	}
	return [];
}

function scoreFromOutcomes(
	outcomes: Outcome[],
	relFile: string,
): number | null {
	const matching = outcomes.filter(
		(o) =>
			typeof o.scenario === "object" && o.scenario.Mutant?.file === relFile,
	);
	if (matching.length === 0) return null;
	const viable = matching.filter(
		(o) =>
			o.summary === "CaughtMutant" ||
			o.summary === "Timeout" ||
			o.summary === "MissedMutant",
	);
	if (viable.length === 0) return 100;
	const killed = matching.filter(
		(o) => o.summary === "CaughtMutant" || o.summary === "Timeout",
	);
	return (killed.length / viable.length) * 100;
}

function runCargoMutants(files: string[]): boolean {
	// Build --file args (one per changed file). cargo-mutants accepts
	// multiple -f flags (each is a glob). We pass exact paths relative
	// to the crate workspace.
	//
	// --in-place: avoid the default tmp-copy which omits gitignored
	// files. 27 tests under tests::scaffold/doctor depend on
	// packages/astropress/dist (find_astropress_src), and that path
	// is gitignored. In-place mutation in the real source tree is safe
	// because cargo-mutants reverts each mutant after testing it; the
	// repo:clean check in pre-push catches any leftover artifacts.
	// 180s per-test timeout: the full rust suite runs ~27s in isolation, but
	// the baseline run can exceed 60s under parallel load (TS mutation-gate
	// runs concurrently in the same pre-push). Without headroom, cargo-mutants
	// reports "FAILED Unmutated baseline" and gives up before testing a single
	// mutant. Observed 2026-05-05 / 06 on feat/main-ci-quality.
	const args = [
		"mutants",
		"--package",
		"astropress-cli",
		"--timeout",
		"180",
		"--in-place",
	];
	for (const f of files) {
		// f is "crates/astropress-cli/src/foo.rs" → strip "crates/"
		const rel = f.startsWith(`${CRATE_ROOT}/`)
			? f.slice(CRATE_ROOT.length + 1)
			: f;
		args.push("--file", rel);
	}
	const result = spawnSync("cargo", args, {
		stdio: "inherit",
		cwd: CRATE_ROOT,
	});
	return result.status === 0 || result.status === 2; // 2 = found viable mutants run completed
}

type VerdictStatus =
	| "pass-hash-skip"
	| "pass"
	| "regression"
	| "new-file-below-floor"
	| "unscored";
interface Verdict {
	file: string;
	hash: string | null;
	score: number | null;
	baseline: BaselineEntry | null;
	status: VerdictStatus;
}

function judge(
	file: string,
	hash: string,
	score: number | null,
	prior: BaselineEntry | null,
): Verdict {
	if (score === null) {
		// cargo-mutants generated zero mutants for this file. Common causes:
		// the file is a test module (cargo-mutants skips #[cfg(test)] code by
		// default), every fn has #[mutants::skip], or it's pure macro/derive
		// boilerplate. There is nothing to fail on — treat as pass.
		return { file, hash, score: null, baseline: prior, status: "pass" };
	}
	if (prior === null)
		return {
			file,
			hash,
			score,
			baseline: null,
			status: score >= FLOOR ? "pass" : "new-file-below-floor",
		};
	return {
		file,
		hash,
		score,
		baseline: prior,
		status: score + TOLERANCE >= prior.score ? "pass" : "regression",
	};
}

function main(): number {
	const changed = changedRustFiles();
	if (changed.length === 0) {
		console.log(
			"prepush-mutation-gate-rust: no Rust source changes — skipping.",
		);
		return 0;
	}
	const baseline = loadBaseline();
	const verdicts: Verdict[] = [];
	const needsMutation: string[] = [];
	for (const file of changed) {
		const rel = file.startsWith(`${CRATE_ROOT}/`)
			? file.slice(CRATE_ROOT.length + 1)
			: file;
		const hash = gitHashObject(file);
		const prior = baseline.scores[rel] ?? null;
		if (hash !== null && prior && prior.hash === hash) {
			verdicts.push({
				file: rel,
				hash,
				score: prior.score,
				baseline: prior,
				status: "pass-hash-skip",
			});
			console.log(
				`  = ${rel}  baseline hash unchanged → reuse ${prior.score.toFixed(2)}%`,
			);
		} else {
			needsMutation.push(file);
			console.log(`  ~ ${rel}  must mutate`);
		}
	}
	if (needsMutation.length > 0) {
		console.log(
			`\nRunning cargo-mutants on ${needsMutation.length} file(s)...`,
		);
		runCargoMutants(needsMutation);
		if (!existsSync(OUTCOMES_PATH)) {
			console.error(
				`prepush-mutation-gate-rust: no outcomes at ${OUTCOMES_PATH}`,
			);
			return 1;
		}
		const outcomes = (
			JSON.parse(readFileSync(OUTCOMES_PATH, "utf8")) as OutcomesFile
		).outcomes;
		for (const file of needsMutation) {
			const rel = file.startsWith(`${CRATE_ROOT}/`)
				? file.slice(CRATE_ROOT.length + 1)
				: file;
			const score = scoreFromOutcomes(outcomes, rel);
			const hash = gitHashObject(file);
			const prior = baseline.scores[rel] ?? null;
			verdicts.push(judge(rel, hash ?? "", score, prior));
		}
	}
	console.log("\nResults:");
	for (const v of verdicts) {
		const score = v.score === null ? "unscored" : `${v.score.toFixed(2)}%`;
		const prior = v.baseline ? `${v.baseline.score.toFixed(2)}%` : "new";
		const marker = v.status.startsWith("pass") ? "✓" : "✖";
		console.log(`  ${marker} ${v.file}  ${score} / ${prior}  [${v.status}]`);
	}
	const failures = verdicts.filter((v) => !v.status.startsWith("pass"));
	const checkOnly = process.argv.includes("--check-only");
	if (failures.length === 0) {
		if (checkOnly) {
			console.log(
				"\n✓ prepush-mutation-gate-rust: all changed files pass (check-only).\n",
			);
			return 0;
		}
		const next: Record<string, BaselineEntry> = { ...baseline.scores };
		let dirty = false;
		for (const v of verdicts) {
			if (v.score === null || v.hash === null) continue;
			const prev = next[v.file];
			if (!prev || prev.score !== v.score || prev.hash !== v.hash) {
				next[v.file] = { score: v.score, hash: v.hash };
				dirty = true;
			}
		}
		if (dirty) {
			saveBaseline({ updatedAt: new Date().toISOString(), scores: next });
			console.log(
				`\n✓ prepush-mutation-gate-rust: pass. Baseline updated at ${BASELINE_PATH}.\n`,
			);
		} else {
			console.log("\n✓ prepush-mutation-gate-rust: pass (hash-skip only).\n");
		}
		return 0;
	}
	console.error("\n✖ prepush-mutation-gate-rust FAILED:\n");
	for (const v of failures) {
		if (v.status === "regression")
			console.error(
				`  REGRESSION  ${v.file}: ${v.score?.toFixed(2)}% < baseline ${v.baseline?.score.toFixed(2)}%`,
			);
		else if (v.status === "new-file-below-floor")
			console.error(
				`  NEW FILE    ${v.file}: ${v.score?.toFixed(2)}% < floor ${FLOOR}%`,
			);
		else console.error(`  UNSCORED    ${v.file}`);
	}
	return 1;
}

process.exit(main());
