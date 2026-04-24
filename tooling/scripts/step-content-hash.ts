#!/usr/bin/env bun
/**
 * step-content-hash — shared content-hash logic for the prepush gate and CI.
 *
 * Each "step" (bdd:test, vitest, test:cli, etc.) declares the set of git
 * paths whose content fully determines its result. git rev-parse HEAD:<path>
 * returns the stable tree-id of that path; concatenating them and hashing
 * produces a short stable fingerprint.
 *
 * Used two ways:
 *   - imported from prepush-gates.ts (local cache short-circuit)
 *   - invoked as a CLI (`bun run step-content-hash.ts <step>`) in CI jobs
 *     so the workflow can key actions/cache against the same hash.
 *
 * IMPORTANT — if you add a step or widen its input surface, update STEP_INPUTS
 * here. A missed input is a false-positive skip waiting to happen.
 */

import { spawnSync } from "node:child_process";

// Step keys match CI job names so the local prepush gate and the CI jobs
// share identical cache keys — a step warmed locally also warms CI, and
// vice-versa when the cache is shared across a team.
export const STEP_INPUTS: Record<string, string[]> = {
	"bdd:test": [
		"tooling/bdd",
		"tooling/scripts/bdd-test.ts",
		"packages/astropress/src",
	],
	"test:cli:smoke": ["crates/astropress-cli", "crates/Cargo.toml"],
	"test-unit": [
		"packages/astropress/src",
		"packages/astropress/tests",
		"packages/astropress/vitest.config.ts",
		"packages/astropress/package.json",
	],
	"test-cli": [
		"crates/astropress-cli",
		"crates/Cargo.toml",
		"crates/Cargo.lock",
		"packages/astropress/src",
	],
	"test-e2e": [
		"packages/astropress/src",
		"packages/astropress/tests",
		"packages/astropress/web-components",
		"tooling/e2e",
		"tooling/scripts/run-playwright.ts",
		"tooling/scripts/port-helpers.ts",
	],
	"test-build-content": ["examples/github-pages", "packages/astropress/src"],
	"test-build-harness": [
		"examples/admin-harness",
		"tooling/bdd",
		"packages/astropress/src",
		"packages/astropress-mcp",
	],
	"test-consumer": [
		"examples/npm-consumer-smoke",
		"packages/astropress/src",
		"tooling/scripts/run-consumer-smoke.ts",
		"tooling/scripts/port-helpers.ts",
	],
	"test-tarball-smoke": [
		"examples/npm-consumer-smoke",
		"packages/astropress",
		"tooling/e2e",
		"tooling/scripts/run-tarball-smoke.ts",
		"tooling/scripts/port-helpers.ts",
	],
	"d1-local-integration": [
		"packages/astropress/src",
		"packages/astropress/tests/d1-local-integration.test.ts",
	],
	build: [
		"packages/astropress/src",
		"packages/astropress/package.json",
		"packages/astropress/tsconfig.json",
	],
};

function treeIdFor(path: string): string | null {
	const r = spawnSync("git", ["rev-parse", `HEAD:${path}`], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * Build a stable content ID by concatenating each path's git tree-id (itself
 * a hash produced by git). No crypto primitive needed — git's own hashes are
 * already content-addressed, so we just stitch them into a single deterministic
 * string suitable for a cache key.
 */
export function hashPaths(paths: string[]): string {
	return paths
		.map((p) => (treeIdFor(p) ?? "missing").slice(0, 10))
		.join("-");
}

export function hashStep(stepName: string): string | null {
	const inputs = STEP_INPUTS[stepName];
	if (!inputs) return null;
	return hashPaths(inputs);
}

// CLI entry point: `bun run step-content-hash.ts <step-name>`.
// Prints the hash to stdout (used by CI to build a cache key).
if (import.meta.main) {
	const step = process.argv[2];
	if (!step) {
		const known = Object.keys(STEP_INPUTS).sort().join("\n  - ");
		console.error(
			`usage: step-content-hash.ts <step-name>\n\nKnown steps:\n  - ${known}`,
		);
		process.exit(2);
	}
	const hash = hashStep(step);
	if (hash === null) {
		console.error(
			`unknown step "${step}" — add it to STEP_INPUTS in tooling/scripts/step-content-hash.ts`,
		);
		process.exit(2);
	}
	process.stdout.write(hash);
}
