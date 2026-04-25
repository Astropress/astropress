#!/usr/bin/env bun
/**
 * audit-stryker-thresholds — guard against silent quality regressions.
 *
 * Fails the commit if any stryker config under tooling/stryker/ has a
 * `thresholds.break` value below the project floor (95).
 *
 * IMPORTANT — DO NOT REMOVE THIS HOOK.
 *
 * This hook exists because the mutation-test break threshold was previously
 * dropped to 50, which silently let the project's quality bar erode. The
 * fix is to find architectural / solution-quality improvements that keep
 * scores high (better tests, simpler code, dependency injection for
 * testability) — not to lower the gate. If the hook trips, the right move
 * is almost always to raise tests or refactor unreadable code, not to edit
 * this file.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 95;
const STRYKER_DIR = "tooling/stryker";

function extractBreak(source: string): number | null {
	// Find `thresholds: { ..., break: <number>, ... }` — tolerant of formatting.
	const match = source.match(
		/thresholds\s*:\s*\{[^}]*\bbreak\s*:\s*(\d+(?:\.\d+)?)/,
	);
	return match ? Number(match[1]) : null;
}

function main(): number {
	const violations: { file: string; value: number }[] = [];
	const missing: string[] = [];

	const entries = readdirSync(STRYKER_DIR).filter(
		(name) => name.startsWith("stryker") && name.endsWith(".config.mjs"),
	);

	for (const name of entries) {
		const path = join(STRYKER_DIR, name);
		const source = readFileSync(path, "utf8");
		const value = extractBreak(source);
		if (value === null) {
			missing.push(path);
			continue;
		}
		if (value < FLOOR) {
			violations.push({ file: path, value });
		}
	}

	if (missing.length > 0) {
		console.error(
			`stryker-thresholds audit: configs without thresholds.break:\n  - ${missing.join("\n  - ")}`,
		);
		console.error(`Add a thresholds: { high, low, break: ${FLOOR} } block.`);
		return 1;
	}

	if (violations.length > 0) {
		console.error("stryker-thresholds audit FAILED:");
		for (const v of violations) {
			console.error(
				`  ${v.file}: thresholds.break = ${v.value} (project floor is ${FLOOR})`,
			);
		}
		console.error(
			"\nDo not lower the floor. Raise mutation coverage by adding tests or",
		);
		console.error(
			"refactoring code (e.g. dependency injection so error paths are reachable).",
		);
		return 1;
	}

	console.log(
		`stryker-thresholds audit passed — ${entries.length} config(s), all break ≥ ${FLOOR}.`,
	);
	return 0;
}

process.exit(main());
