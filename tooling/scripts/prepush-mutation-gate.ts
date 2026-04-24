#!/usr/bin/env bun
/**
 * prepush-mutation-gate — delta-based mutation coverage gate.
 *
 * Runs Stryker once over every TypeScript source file changed on this branch
 * vs. origin/main, then checks each file's score against a committed baseline:
 *
 *   - If the file is in tooling/stryker/baseline-scores.json: the new score
 *     must be >= baseline - 0.5% (tolerance for inter-run flakiness).
 *   - If the file is new (no baseline entry): the new score must be >= 95%.
 *
 * On pass, the baseline is rewritten with the new per-file scores — commit
 * it to lock in the new floor.
 *
 * IMPORTANT — DO NOT WEAKEN THIS HOOK.
 *
 * The 95% break threshold lives in stryker*.config.mjs and is guarded by
 * audit-stryker-thresholds. This hook is the live complement: it blocks
 * pushes whose *new* code misses the floor and whose *changed* code
 * regresses against its prior score, without demanding that every legacy
 * file already sit at 95%. If this trips, write tests or simplify code.
 * Don't hand-edit baseline-scores.json — the script rewrites it only from
 * a passing run.
 */

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FLOOR = 95;
const TOLERANCE = 0.5;
const SRC_ROOT = "packages/astropress/src/";
const BASELINE_PATH = "tooling/stryker/baseline-scores.json";

interface Baseline {
	updatedAt: string;
	scores: Record<string, number>;
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

function changedSourceFiles(): string[] {
	const refs = ["origin/main", "HEAD~1"];
	for (const ref of refs) {
		try {
			execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "pipe" });
			const out = execFileSync(
				"git",
				[
					"diff",
					"--name-only",
					`${ref}...HEAD`,
					"--",
					`${SRC_ROOT}*.ts`,
					`${SRC_ROOT}**/*.ts`,
				],
				{ encoding: "utf8" },
			);
			return out
				.split("\n")
				.filter((line) => line.endsWith(".ts") && !line.endsWith(".d.ts"));
		} catch {
			// Ref missing — try the next.
		}
	}
	return [];
}

interface StrykerReport {
	files: Record<string, { mutants: Array<{ status: string }> }>;
}

function runStryker(
	mutateTargets: string[],
	tmpRoot: string,
): StrykerReport | null {
	const configPath = join(tmpRoot, "stryker.config.mjs");
	const reportPath = join(tmpRoot, "report.json");
	writeFileSync(
		configPath,
		`export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ${JSON.stringify(mutateTargets)},
  testRunner: "vitest",
  coverageAnalysis: "all",
  vitest: { related: true },
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: ${JSON.stringify(reportPath)} },
  incremental: false,
  timeoutMS: 120000,
  dryRunTimeoutMinutes: 15,
  thresholds: { high: 95, low: 95, break: 0 },
};
`,
	);
	const strykerBin = join(process.cwd(), "node_modules/.bin/stryker");
	try {
		execFileSync("node", [strykerBin, "run", configPath], {
			cwd: join(process.cwd(), "packages/astropress"),
			stdio: "inherit",
		});
	} catch {
		// Break threshold set to 0, so non-zero exit means a real error.
		// Fall through and try to read the report regardless.
	}
	if (!existsSync(reportPath)) return null;
	return JSON.parse(readFileSync(reportPath, "utf8")) as StrykerReport;
}

function scoreForFile(
	report: StrykerReport,
	mutatePath: string,
): number | null {
	const key = Object.keys(report.files).find((k) => k.endsWith(mutatePath));
	if (!key) return null;
	const mutants = report.files[key].mutants;
	const scored = mutants.filter(
		(m) => m.status !== "Ignored" && m.status !== "NoCoverage",
	);
	const killed = mutants.filter(
		(m) => m.status === "Killed" || m.status === "Timeout",
	);
	if (scored.length === 0) return 100;
	return (killed.length / scored.length) * 100;
}

interface Verdict {
	file: string;
	score: number | null;
	baseline: number | null;
	status: "pass" | "regression" | "new-file-below-floor" | "unscored";
}

function judge(
	file: string,
	score: number | null,
	baseline: number | null,
): Verdict {
	if (score === null) {
		return { file, score: null, baseline, status: "unscored" };
	}
	if (baseline === null) {
		return {
			file,
			score,
			baseline: null,
			status: score >= FLOOR ? "pass" : "new-file-below-floor",
		};
	}
	return {
		file,
		score,
		baseline,
		status: score + TOLERANCE >= baseline ? "pass" : "regression",
	};
}

function main(): number {
	const changed = changedSourceFiles();
	if (changed.length === 0) {
		console.log(
			"prepush-mutation-gate: no TypeScript source changes — skipping.",
		);
		return 0;
	}

	const PREFIX = "packages/astropress/";
	const mutateTargets = changed
		.filter((f) => f.startsWith(PREFIX))
		.map((f) => f.slice(PREFIX.length));
	if (mutateTargets.length === 0) {
		console.log(
			"prepush-mutation-gate: changed files outside packages/astropress/ — skipping.",
		);
		return 0;
	}

	const baseline = loadBaseline();
	console.log(
		`prepush-mutation-gate: ${mutateTargets.length} file(s) to mutate`,
	);
	console.log(`  baseline last updated: ${baseline.updatedAt}`);
	for (const t of mutateTargets) console.log(`  - ${t}`);

	const tmp = mkdtempSync(join(tmpdir(), "stryker-prepush-"));
	let report: StrykerReport | null = null;
	try {
		report = runStryker(mutateTargets, tmp);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
	if (!report) {
		console.error("prepush-mutation-gate: stryker produced no report.");
		return 1;
	}

	const verdicts: Verdict[] = [];
	for (let i = 0; i < changed.length; i++) {
		const full = changed[i];
		if (!full.startsWith(PREFIX)) continue;
		const target = full.slice(PREFIX.length);
		const score = scoreForFile(report, target);
		const prior = baseline.scores[full] ?? null;
		verdicts.push(judge(full, score, prior));
	}

	console.log("\nPer-file results (current / baseline):");
	for (const v of verdicts) {
		const scoreStr = v.score === null ? "unscored" : `${v.score.toFixed(2)}%`;
		const priorStr = v.baseline === null ? "new" : `${v.baseline.toFixed(2)}%`;
		const marker = v.status === "pass" ? "✓" : "✖";
		console.log(
			`  ${marker} ${v.file}  ${scoreStr} / ${priorStr}  [${v.status}]`,
		);
	}

	const failures = verdicts.filter((v) => v.status !== "pass");
	if (failures.length === 0) {
		const nextScores = { ...baseline.scores };
		for (const v of verdicts) {
			if (v.score !== null) nextScores[v.file] = v.score;
		}
		saveBaseline({
			updatedAt: new Date().toISOString(),
			scores: nextScores,
		});
		console.log(
			`\n✓ prepush-mutation-gate: all changed files pass. Baseline updated at ${BASELINE_PATH}.\n`,
		);
		return 0;
	}

	console.error("\n✖ prepush-mutation-gate FAILED:\n");
	for (const v of failures) {
		if (v.status === "regression") {
			console.error(
				`  REGRESSION  ${v.file}: ${v.score?.toFixed(2)}% < baseline ${v.baseline?.toFixed(2)}%`,
			);
		} else if (v.status === "new-file-below-floor") {
			console.error(
				`  NEW FILE    ${v.file}: ${v.score?.toFixed(2)}% < floor ${FLOOR}%`,
			);
		} else {
			console.error(`  UNSCORED    ${v.file}`);
		}
	}
	console.error(
		"\n  Raise tests or simplify code. Do not hand-edit baseline-scores.json.\n",
	);
	return 1;
}

process.exit(main());
