#!/usr/bin/env bun
/**
 * prepush-mutation-gate — runs Stryker scoped to the TypeScript source files
 * changed on this branch vs. origin/main (or HEAD~1 as fallback). Fails the
 * push if the mutation score on changed files is below the project floor (95).
 *
 * IMPORTANT — DO NOT WEAKEN THIS HOOK.
 *
 * Running the full stryker suite (≈ 10 minutes) per push is unworkable, so
 * this hook narrows the scope to *what this branch changed*. That keeps the
 * gate fast (typically < 60s for a normal PR) while still blocking silent
 * coverage regressions before they reach main. Removing or relaxing this
 * hook reopens the hole where a PR can land between weekly full-suite
 * mutation runs without ever proving its new code is test-worthy.
 *
 * If this trips: add tests, refactor out equivalent mutants, or delete
 * dead defensive code. Don't lower the threshold.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FLOOR = 95;
const SRC_ROOT = "packages/astropress/src/";

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
			// Ref missing (fresh clone, first commit, etc.) — try the next.
		}
	}
	return [];
}

function main(): number {
	const changed = changedSourceFiles();
	if (changed.length === 0) {
		console.log(
			"prepush-mutation-gate: no TypeScript source changes — skipping.",
		);
		return 0;
	}

	// Paths are repo-relative; stryker runs from packages/astropress/, so rewrite.
	const PREFIX = "packages/astropress/";
	const mutateTargets = changed
		.filter((f) => f.startsWith(PREFIX))
		.map((f) => f.slice(PREFIX.length));

	if (mutateTargets.length === 0) {
		console.log(
			"prepush-mutation-gate: changed files are outside packages/astropress/src/ — skipping.",
		);
		return 0;
	}

	console.log(
		`prepush-mutation-gate: mutating ${mutateTargets.length} changed file(s):`,
	);
	for (const t of mutateTargets) console.log(`  - ${t}`);

	const tmp = mkdtempSync(join(tmpdir(), "stryker-prepush-"));
	const configPath = join(tmp, "stryker.config.mjs");
	writeFileSync(
		configPath,
		`export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ${JSON.stringify(mutateTargets)},
  testRunner: "vitest",
  coverageAnalysis: "all",
  vitest: { related: true },
  reporters: ["clear-text"],
  incremental: false,
  timeoutMS: 120000,
  dryRunTimeoutMinutes: 15,
  maxTestRunnerReuse: 20,
  thresholds: { high: ${FLOOR}, low: ${FLOOR}, break: ${FLOOR} },
};
`,
	);

	const strykerBin = join(process.cwd(), "node_modules/.bin/stryker");

	try {
		execFileSync("node", [strykerBin, "run", configPath], {
			cwd: join(process.cwd(), "packages/astropress"),
			stdio: "inherit",
		});
		return 0;
	} catch {
		console.error(
			`\n✖ prepush-mutation-gate FAILED: mutation score on changed files < ${FLOOR}%.`,
		);
		console.error(
			"Raise tests or simplify code. Do not lower the threshold — see the",
		);
		console.error(
			"header of tooling/scripts/prepush-mutation-gate.ts for the rationale.",
		);
		return 1;
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

process.exit(main());
