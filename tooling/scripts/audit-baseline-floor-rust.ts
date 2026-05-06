#!/usr/bin/env bun
/**
 * audit-baseline-floor-rust — block commits that lower a Rust mutation
 * score floor recorded in tooling/cargo-mutants/baseline-scores.json.
 * Mirror of audit-baseline-floor.ts for cargo-mutants.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE_PATH = "tooling/cargo-mutants/baseline-scores.json";
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

function main(): number {
	const ref = "HEAD";
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
	} catch {
		console.log("audit-baseline-floor-rust: no HEAD ref — skipping.");
		return 0;
	}
	const before = readBaselineFromGit(ref);
	const after = readBaselineFromDisk();
	// First-time creation: the baseline file did not exist at HEAD. Treat
	// every entry as a snapshot of the historical state, not as net-new
	// regressions. Subsequent commits will compare against this snapshot.
	if (before === null) {
		console.log(
			`audit-baseline-floor-rust: ${BASELINE_PATH} not present at ${ref} — accepting first-time baseline (${Object.keys(after.scores).length} entries, ${Object.values(after.scores).filter((e) => e.score < FLOOR).length} below ${FLOOR}%).`,
		);
		return 0;
	}
	const beforeScores = before.scores;
	const drops: { file: string; from: number; to: number }[] = [];
	const newBelowFloor: { file: string; score: number }[] = [];
	for (const [file, entry] of Object.entries(after.scores)) {
		const prior = beforeScores[file];
		if (!prior) {
			if (entry.score < FLOOR - TOLERANCE) newBelowFloor.push({ file, score: entry.score });
			continue;
		}
		if (entry.score + TOLERANCE < prior.score)
			drops.push({ file, from: prior.score, to: entry.score });
	}
	if (drops.length === 0 && newBelowFloor.length === 0) {
		console.log(
			`audit-baseline-floor-rust passed — no regressions vs ${ref} (${Object.keys(after.scores).length} entries).`,
		);
		return 0;
	}
	console.error("\n✖ audit-baseline-floor-rust FAILED:\n");
	for (const d of drops)
		console.error(`  REGRESSION  ${d.file}: ${d.from.toFixed(2)}% → ${d.to.toFixed(2)}%`);
	for (const n of newBelowFloor)
		console.error(`  NEW BELOW FLOOR  ${n.file}: ${n.score.toFixed(2)}% < ${FLOOR}%`);
	console.error(
		`\n  Baselines may move up freely, but never down. New files must score >= ${FLOOR}%.`,
	);
	return 1;
}

process.exit(main());
