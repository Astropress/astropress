#!/usr/bin/env bun
/**
 * prepush-mutation-gate — content-hash-aware delta mutation coverage gate.
 *
 * For each TypeScript source file changed on this branch vs. origin/main:
 *   - Compare its current git-blob hash against the hash recorded in
 *     tooling/stryker/baseline-scores.json.
 *   - If the hash matches, the file's content hasn't changed since the
 *     baseline was captured, so the prior score is authoritative — skip
 *     the Stryker run entirely. This is what keeps the gate fast: only
 *     files whose content actually moved get mutated.
 *   - If the hash differs, run Stryker scoped to that one file and check:
 *       * existing baseline: new score must be >= baseline - 0.5% (tolerance
 *         for inter-run noise).
 *       * new file (no baseline entry): new score must be >= 95%.
 *
 * On pass, the baseline is rewritten with the new per-file {score, hash}.
 * Commit the file to lock in the new floor.
 *
 * IMPORTANT — DO NOT WEAKEN THIS HOOK.
 *
 * The 95% break threshold lives in stryker*.config.mjs and is guarded by
 * audit-stryker-thresholds. This hook is the live complement: it blocks
 * pushes whose *new* code misses the floor and whose *changed* code
 * regresses against its prior score. The content-hash skip is the *only*
 * mechanism that keeps it cheap enough to run on every push — do not
 * replace it with "always run Stryker on every touched file" out of
 * paranoia. The hash check is trustworthy: identical content produces
 * identical mutation results.
 *
 * If this trips: write tests or simplify code. Do not hand-edit
 * baseline-scores.json — the script rewrites it only from a passing run.
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

interface BaselineEntry {
	score: number;
	hash: string;
}

interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
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
	if (mutateTargets.length === 0) return { files: {} };
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
		// Fall through and read the report regardless.
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

function judgeScored(
	file: string,
	hash: string,
	score: number | null,
	baseline: BaselineEntry | null,
): Verdict {
	if (score === null) {
		return { file, hash, score: null, baseline, status: "unscored" };
	}
	if (baseline === null) {
		return {
			file,
			hash,
			score,
			baseline: null,
			status: score >= FLOOR ? "pass" : "new-file-below-floor",
		};
	}
	return {
		file,
		hash,
		score,
		baseline,
		status: score + TOLERANCE >= baseline.score ? "pass" : "regression",
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
	// Pure-type files excluded from `tooling/stryker/stryker.config.mjs` (no
	// runtime code → Stryker produces no mutants → score is null). Skip them
	// here so a typedef-only change doesn't fail the gate as "UNSCORED".
	const TYPE_ONLY_FILES = new Set<string>([
		`${PREFIX}src/persistence-types.ts`,
		`${PREFIX}src/config-service-types.ts`,
	]);
	const repoRelative = changed
		.filter((f) => f.startsWith(PREFIX))
		.filter((f) => !TYPE_ONLY_FILES.has(f));
	if (repoRelative.length === 0) {
		console.log(
			"prepush-mutation-gate: changed files outside packages/astropress/ (or are type-only) — skipping.",
		);
		return 0;
	}

	const baseline = loadBaseline();
	console.log(
		`prepush-mutation-gate: ${repoRelative.length} changed file(s); baseline updated ${baseline.updatedAt}`,
	);

	// Split into hash-match (skip Stryker) and hash-diff (must run Stryker).
	const verdicts: Verdict[] = [];
	const needsMutation: string[] = [];
	for (const file of repoRelative) {
		const hash = gitHashObject(file);
		const prior = baseline.scores[file] ?? null;
		if (hash !== null && prior && prior.hash === hash) {
			verdicts.push({
				file,
				hash,
				score: prior.score,
				baseline: prior,
				status: "pass-hash-skip",
			});
			console.log(
				`  = ${file}  hash unchanged → reuse ${prior.score.toFixed(2)}%`,
			);
		} else {
			needsMutation.push(file);
			console.log(`  ~ ${file}  hash differs → must mutate`);
		}
	}

	if (needsMutation.length > 0) {
		console.log(
			`\nRunning Stryker on ${needsMutation.length} file(s) with changed content...`,
		);
		const tmp = mkdtempSync(join(tmpdir(), "stryker-prepush-"));
		let report: StrykerReport | null = null;
		try {
			const targets = needsMutation.map((f) => f.slice(PREFIX.length));
			report = runStryker(targets, tmp);
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
		if (!report) {
			console.error("prepush-mutation-gate: stryker produced no report.");
			return 1;
		}
		for (const file of needsMutation) {
			const target = file.slice(PREFIX.length);
			const score = scoreForFile(report, target);
			const hash = gitHashObject(file);
			const prior = baseline.scores[file] ?? null;
			verdicts.push(judgeScored(file, hash ?? "", score, prior));
		}
	}

	console.log("\nResults:");
	for (const v of verdicts) {
		const scoreStr = v.score === null ? "unscored" : `${v.score.toFixed(2)}%`;
		const priorStr = v.baseline ? `${v.baseline.score.toFixed(2)}%` : "new";
		const marker = v.status.startsWith("pass") ? "✓" : "✖";
		console.log(
			`  ${marker} ${v.file}  ${scoreStr} / ${priorStr}  [${v.status}]`,
		);
	}

	const failures = verdicts.filter((v) => !v.status.startsWith("pass"));
	const checkOnly = process.argv.includes("--check-only");

	if (failures.length === 0) {
		if (checkOnly) {
			console.log(
				"\n✓ prepush-mutation-gate: all changed files pass (check-only, baseline not rewritten).\n",
			);
			return 0;
		}
		// Only rewrite the baseline when a real change is warranted — i.e. at
		// least one entry's score or hash actually moved. This keeps the
		// timestamp from marking the worktree dirty on hash-skip-only runs.
		const nextScores: Record<string, BaselineEntry> = { ...baseline.scores };
		let dirty = false;
		for (const v of verdicts) {
			if (v.score === null || v.hash === null) continue;
			const prev = nextScores[v.file];
			if (!prev || prev.score !== v.score || prev.hash !== v.hash) {
				nextScores[v.file] = { score: v.score, hash: v.hash };
				dirty = true;
			}
		}
		if (dirty) {
			saveBaseline({
				updatedAt: new Date().toISOString(),
				scores: nextScores,
			});
			// Inside a `git push` (lefthook pre-push), writing the baseline file
			// here makes the worktree dirty, which trips repo:clean later in the
			// same hook and aborts the push. The user has to re-amend and re-push.
			// Detect that case and fail loudly with the exact recovery commands,
			// so the failure message says what to do instead of producing a
			// misleading repo:clean error 5 minutes later. Outside a push (manual
			// invocation), the message is still useful as a reminder to commit.
			const inPush =
				process.env.LEFTHOOK_PUSH === "1" || process.env.GIT_PUSH === "1";
			if (inPush) {
				console.error(
					`\n✖ prepush-mutation-gate: baseline updated at ${BASELINE_PATH} during a push.\n  The remaining pre-push gates will fail repo:clean because the worktree is now dirty.\n  Recovery:\n    git add ${BASELINE_PATH}\n    git commit --amend --no-edit\n    git push\n`,
				);
				return 1;
			}
			console.log(
				`\n✓ prepush-mutation-gate: all changed files pass. Baseline updated at ${BASELINE_PATH}.\n` +
					`  Remember to commit ${BASELINE_PATH} before pushing — repo:clean will reject a dirty worktree.\n`,
			);
		} else {
			console.log(
				"\n✓ prepush-mutation-gate: all changed files pass (hash-skip only; baseline already current).\n",
			);
		}
		return 0;
	}

	console.error("\n✖ prepush-mutation-gate FAILED:\n");
	for (const v of failures) {
		if (v.status === "regression") {
			console.error(
				`  REGRESSION  ${v.file}: ${v.score?.toFixed(2)}% < baseline ${v.baseline?.score.toFixed(2)}%`,
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
