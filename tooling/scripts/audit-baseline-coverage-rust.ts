#!/usr/bin/env bun
/**
 * audit-baseline-coverage-rust — assert every Rust src file under
 * crates/astropress-cli/src has a baseline entry in
 * tooling/cargo-mutants/baseline-scores.json. Mirror of
 * audit-baseline-coverage.ts for TypeScript.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const CRATE_ROOT = "crates";
const SRC_PREFIX = "astropress-cli/src";
const BASELINE_PATH = "tooling/cargo-mutants/baseline-scores.json";

const EXCLUDE: ((p: string) => boolean)[] = [
	// In-source test modules under src/tests/ are run by cargo-mutants but
	// the test code itself is not mutated. cargo-mutants only mutates
	// non-test source.
	(p) => p.includes(`${SRC_PREFIX}/tests/`),
	(p) => isMarkedDataOnly(join(CRATE_ROOT, p)),
];

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

function isMarkedDataOnly(path: string): boolean {
	try {
		const head = readFileSync(path, "utf8").split("\n").slice(0, 10).join("\n");
		return head.includes("mutants-disable-file: data-only");
	} catch {
		return false;
	}
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (entry.isFile() && entry.name.endsWith(".rs")) out.push(full);
	}
	return out;
}

function eligibleFiles(): string[] {
	const root = join(CRATE_ROOT, SRC_PREFIX);
	if (!existsSync(root)) {
		console.error(`audit-baseline-coverage-rust: missing ${root}`);
		process.exit(1);
	}
	const all = walk(root).map((p) => relative(CRATE_ROOT, p));
	return all.filter((p) => !EXCLUDE.some((m) => m(p))).sort();
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

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) return { updatedAt: "never", scores: {} };
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function main(): number {
	const eligible = eligibleFiles();
	const baseline = loadBaseline();
	const missing: string[] = [];
	const stale: { file: string }[] = [];
	for (const file of eligible) {
		const entry = baseline.scores[file];
		if (!entry) {
			missing.push(file);
			continue;
		}
		const hash = gitHashObject(join(CRATE_ROOT, file));
		if (hash && entry.hash !== hash) stale.push({ file });
	}
	const orphans = Object.keys(baseline.scores).filter(
		(f) => !existsSync(join(CRATE_ROOT, f)),
	);
	if (missing.length === 0 && orphans.length === 0) {
		console.log(
			`audit-baseline-coverage-rust passed — ${eligible.length} Rust src files, all in ${BASELINE_PATH}${
				stale.length > 0
					? ` (${stale.length} hash-drifted; gate will re-score on push)`
					: ""
			}.`,
		);
		return 0;
	}
	console.error("\n✖ audit-baseline-coverage-rust FAILED:\n");
	if (missing.length > 0) {
		console.error(`  ${missing.length} Rust file(s) missing from baseline:`);
		for (const f of missing) console.error(`    ${f}`);
		console.error(
			"\n  Populate via: bun run tooling/scripts/prepush-mutation-gate-rust.ts (after a full cargo-mutants run).",
		);
	}
	if (orphans.length > 0) {
		console.error(
			`\n  ${orphans.length} baseline entries point to deleted files:`,
		);
		for (const f of orphans) console.error(`    ${f}`);
	}
	return 1;
}

process.exit(main());
