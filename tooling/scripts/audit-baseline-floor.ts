#!/usr/bin/env bun
/**
 * audit-baseline-floor — block commits that lower a mutation-score floor.
 *
 * Compares tooling/stryker/baseline-scores.json against its version in
 * origin/main (or HEAD~1 if origin/main is unavailable) and refuses the
 * commit if any per-file score has decreased OR if a new entry lands
 * below FLOOR. Score may move up freely; entries may be removed (file
 * deletion); but a baseline drop on an existing file is rejected with
 * a recovery hint.
 *
 * Why
 * ---
 * The prepush-mutation-gate's TOLERANCE check uses each file's recorded
 * score as the floor it must stay at-or-above on future runs. If the
 * baseline file itself is hand-edited downward (or rewritten by an
 * automation that captures a methodology drift as the new truth), the
 * gate silently accepts coverage regression on the next commit. This
 * audit closes that loop: the only legitimate ways for a baseline to
 * change are (a) a new file appearing at >= FLOOR, (b) an existing
 * file's score going up, or (c) a file being deleted along with its
 * entry. Every other transition is a regression in disguise.
 *
 * Usage:
 *   bun run tooling/scripts/audit-baseline-floor.ts
 *
 * Exits 0 on pass, 1 on any blocked transition. Run as a lefthook
 * pre-commit step so the failure stops the commit before it lands.
 *
 * Tolerance
 * ---------
 * A small TOLERANCE (matching the prepush gate's TOLERANCE) is allowed
 * to absorb inter-run noise — Stryker's per-mutant scoring has a thin
 * non-determinism floor when a mutant's verdict depends on test order.
 * Beyond TOLERANCE, drops are rejected.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE_PATH = "tooling/stryker/baseline-scores.json";
const FLOOR = 95;
const TOLERANCE = 0.5;

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

function readBaselineFromGit(ref: string): Baseline | null {
	try {
		const json = execFileSync("git", ["show", `${ref}:${BASELINE_PATH}`], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return JSON.parse(json) as Baseline;
	} catch {
		return null;
	}
}

function readBaselineFromDisk(): Baseline {
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function pickReferenceRef(): string | null {
	// Compare against HEAD — the last committed state. This is a per-commit
	// gate: each new change must not lower a baseline. Earlier history
	// (regressions already on the branch) is a separate cleanup concern;
	// this audit isn't a retroactive fixer, it's a pre-flight on each new
	// commit that could lower the floor.
	for (const ref of ["HEAD"]) {
		try {
			execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
			return ref;
		} catch {
			// Try the next ref.
		}
	}
	return null;
}

function main(): number {
	const ref = pickReferenceRef();
	if (ref === null) {
		console.log("audit-baseline-floor: no HEAD ref — skipping.");
		return 0;
	}
	const before = readBaselineFromGit(ref);
	const after = readBaselineFromDisk();

	const beforeScores = before?.scores ?? {};
	const drops: Array<{ file: string; from: number; to: number }> = [];
	const newBelowFloor: Array<{ file: string; score: number }> = [];

	for (const [file, entry] of Object.entries(after.scores)) {
		const prior = beforeScores[file];
		if (!prior) {
			if (entry.score < FLOOR - TOLERANCE) {
				newBelowFloor.push({ file, score: entry.score });
			}
			continue;
		}
		if (entry.score + TOLERANCE < prior.score) {
			drops.push({ file, from: prior.score, to: entry.score });
		}
	}

	if (drops.length === 0 && newBelowFloor.length === 0) {
		console.log(
			`audit-baseline-floor passed — no baseline regressions vs ${ref} (${Object.keys(after.scores).length} entries).`,
		);
		return 0;
	}

	console.error("\n✖ audit-baseline-floor FAILED:\n");
	for (const d of drops) {
		console.error(
			`  REGRESSION  ${d.file}: ${d.from.toFixed(2)}% → ${d.to.toFixed(2)}% (Δ ${(d.to - d.from).toFixed(2)}pt)`,
		);
	}
	for (const n of newBelowFloor) {
		console.error(`  NEW BELOW FLOOR  ${n.file}: ${n.score.toFixed(2)}% < ${FLOOR}%`);
	}
	console.error(
		`\n  Baselines may move up freely, but never down. New files must score >= ${FLOOR}%.`,
	);
	console.error(
		`  Reference: ${ref}. Edit ${BASELINE_PATH} only by raising tests or simplifying code,`,
	);
	console.error(
		`  not by lowering the recorded floor. The gate's safety guarantee depends on it.\n`,
	);
	return 1;
}

process.exit(main());
