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
import { createHash } from "node:crypto";

export const STEP_INPUTS: Record<string, string[]> = {
	"bdd:test": [
		"tooling/bdd",
		"tooling/scripts/bdd-test.ts",
		"packages/astropress/src",
	],
	"vitest run (plain)": [
		"packages/astropress/src",
		"packages/astropress/tests",
		"packages/astropress/vitest.config.ts",
	],
	"test:cli:smoke": ["crates/astropress-cli", "crates/Cargo.toml"],
	"test:example": ["examples/github-pages", "packages/astropress/src"],

	// CI-only step aliases (mirror the local ones).
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
		"playwright.config.ts",
	],
	"test-build-content": ["examples/github-pages", "packages/astropress/src"],
	"test-build-harness": [
		"examples/admin-harness",
		"tooling/bdd",
		"packages/astropress/src",
		"packages/astropress-mcp",
	],
	"test-consumer": ["examples/npm-consumer-smoke", "packages/astropress/src"],
	"test-tarball-smoke": ["examples/npm-consumer-smoke", "packages/astropress"],
	"d1-local-integration": [
		"packages/astropress/src",
		"packages/astropress/tests/d1-local-integration.test.ts",
	],
};

function treeIdFor(path: string): string | null {
	const r = spawnSync("git", ["rev-parse", `HEAD:${path}`], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	return r.status === 0 ? r.stdout.trim() : null;
}

export function hashPaths(paths: string[]): string {
	const parts = paths.map((p) => `${p}\t${treeIdFor(p) ?? "MISSING"}`);
	return createHash("sha256")
		.update(parts.join("\n"))
		.digest("hex")
		.slice(0, 16);
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
