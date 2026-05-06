#!/usr/bin/env bun
/**
 * audit-astro-check — run `astro check` against the framework and gate on
 * NEW errored files (per-file grandfather pattern).
 *
 * Why per-file and not per-error count: the global error count drifts every
 * time someone reformats / refactors a file with multiple errors. A file-level
 * gate ratchets cleanly: a file that wasn't in the baseline can never
 * introduce errors; a file that was in the baseline can fix-or-stay.
 *
 * Baseline file: tooling/audit-output/astro-check-baseline.json
 *   { "erroredFiles": ["packages/astropress/pages/...", ...] }
 *
 * Exit codes:
 *   0 — no NEW errored files (errors in baseline-listed files allowed)
 *   1 — at least one new errored file; prints the list
 *   2 — astro check failed to run
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASELINE = "tooling/audit-output/astro-check-baseline.json";
const OUT = "tooling/audit-output/astro-check.json";
const REWRITE = process.argv.includes("--rewrite-baseline");

interface Baseline {
	erroredFiles: string[];
	updatedAt: string;
}

function runCheck(): { erroredFiles: string[]; totalErrors: number } {
	let stdout = "";
	try {
		stdout = execFileSync(
			"bunx",
			["astro", "check", "--root", "packages/astropress"],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		);
	} catch (e) {
		const err = e as { stdout?: string };
		stdout = err.stdout ?? "";
	}
	// Strip ANSI escape sequences so the path-extraction regex isn't confused.
	// String.fromCharCode(27) = ESC; biome rejects \x1b literal in regex.
	const ESC = String.fromCharCode(27);
	const ansi = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
	const clean = stdout.replace(ansi, "");
	// Lines look like: "components/X.astro:12:5 - error ts(2339): ..."
	// Or: "src/foo.ts:1:1 - error ts(...)..."
	const re =
		/^(packages\/astropress\/[^:\s]+|components\/[^:\s]+|src\/[^:\s]+|pages\/[^:\s]+):\d+:\d+ - error/gm;
	const erroredFiles = new Set<string>();
	for (const m of clean.matchAll(re)) {
		let p = m[1];
		if (!p.startsWith("packages/astropress/")) {
			p = `packages/astropress/${p}`;
		}
		erroredFiles.add(p);
	}
	const total = (clean.match(/- error/g) ?? []).length;
	return { erroredFiles: [...erroredFiles].sort(), totalErrors: total };
}

const result = runCheck();

if (REWRITE) {
	if (!existsSync(dirname(BASELINE))) {
		mkdirSync(dirname(BASELINE), { recursive: true });
	}
	const next: Baseline = {
		updatedAt: new Date().toISOString(),
		erroredFiles: result.erroredFiles,
	};
	writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
	console.log(
		`astro-check baseline rewritten: ${result.erroredFiles.length} errored files (${result.totalErrors} total errors).`,
	);
	process.exit(0);
}

const baseline: Baseline = existsSync(BASELINE)
	? (JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline)
	: { erroredFiles: [], updatedAt: "" };

const baselineSet = new Set(baseline.erroredFiles);
const newErroredFiles = result.erroredFiles.filter((p) => !baselineSet.has(p));
const fixedFiles = baseline.erroredFiles.filter(
	(p) => !result.erroredFiles.includes(p),
);

const report = {
	generatedAt: new Date().toISOString(),
	totalErrors: result.totalErrors,
	currentErroredFileCount: result.erroredFiles.length,
	baselineErroredFileCount: baseline.erroredFiles.length,
	newErroredFiles,
	fixedFiles,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

if (newErroredFiles.length > 0) {
	console.error(
		`astro-check FAIL: ${newErroredFiles.length} NEW file(s) with type errors:`,
	);
	for (const p of newErroredFiles) console.error(`  - ${p}`);
	console.error(
		"\nFix the new errors, OR if you intentionally added a known-broken file, run:\n  bun run tooling/scripts/audit-astro-check.ts --rewrite-baseline",
	);
	process.exit(1);
}

console.log(
	`astro-check OK: ${result.erroredFiles.length} files with errors (${result.totalErrors} total) — none new. ${fixedFiles.length} files cleaned up since baseline.`,
);
