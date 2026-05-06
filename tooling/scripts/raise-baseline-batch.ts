#!/usr/bin/env bun
/**
 * raise-baseline-batch — fan a directory or glob into a single
 * raise-baseline invocation.
 *
 * `raise-baseline` already accepts multiple files in one call (one Stryker
 * run, one tmp-config), so the batch speedup comes from giving operators
 * an ergonomic way to express "rebaseline this whole subdirectory" or
 * "rebaseline every file currently below 95% in the baseline" without
 * shell-quoting a long file list.
 *
 * Usage:
 *   bun run raise:batch packages/astropress/src/sqlite-runtime
 *   bun run raise:batch --below 95          # everything currently < 95%
 *   bun run raise:batch --below 95 --fast   # plus stryker fast mode
 *   bun run raise:batch --new               # files not yet in baseline
 *   bun run raise:batch packages/.../foo.ts packages/.../bar.ts  # explicit
 *
 * Flags are forwarded to raise-baseline.ts when relevant; the only one
 * raise-baseline currently understands is --fast.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	encoding: "utf8",
}).trim();
const BASELINE_PATH = join(REPO_ROOT, "tooling/stryker/baseline-scores.json");
const SRC_PREFIX = "packages/astropress/";

interface BaselineEntry {
	score: number;
	hash: string;
}
interface Baseline {
	updatedAt: string;
	scores: Record<string, BaselineEntry>;
}

function loadBaseline(): Baseline {
	if (!existsSync(BASELINE_PATH)) return { updatedAt: "never", scores: {} };
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function listSrcFiles(dir: string): string[] {
	const out: string[] = [];
	const entries = execFileSync(
		"find",
		[dir, "-type", "f", "-name", "*.ts", "-not", "-name", "*.d.ts"],
		{ encoding: "utf8" },
	);
	for (const line of entries.split("\n")) {
		const trimmed = line.trim();
		if (trimmed) out.push(relative(REPO_ROOT, resolve(trimmed)));
	}
	return out.filter((f) => f.startsWith(SRC_PREFIX));
}

function expandTargets(args: string[]): string[] {
	const baseline = loadBaseline();
	const out = new Set<string>();
	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (arg === "--below") {
			const threshold = Number.parseFloat(args[i + 1] ?? "");
			if (!Number.isFinite(threshold)) {
				throw new Error("--below requires a numeric threshold");
			}
			for (const [file, entry] of Object.entries(baseline.scores)) {
				if (entry.score < threshold) out.add(file);
			}
			i += 2;
			continue;
		}
		if (arg === "--new") {
			const all = listSrcFiles(join(REPO_ROOT, "packages/astropress/src"));
			for (const file of all) {
				if (!baseline.scores[file]) out.add(file);
			}
			i += 1;
			continue;
		}
		// Bare path — file or directory.
		const abs = resolve(arg);
		if (!existsSync(abs)) {
			throw new Error(`raise-baseline-batch: path does not exist: ${arg}`);
		}
		if (statSync(abs).isDirectory()) {
			for (const file of listSrcFiles(abs)) out.add(file);
		} else {
			out.add(relative(REPO_ROOT, abs));
		}
		i += 1;
	}
	return [...out].sort();
}

function main(): number {
	const argv = process.argv.slice(2);
	if (argv.length === 0) {
		console.error(
			"Usage: raise-baseline-batch [--fast] [--below N|--new|<path>...]\n" +
				"Examples:\n" +
				"  raise-baseline-batch packages/astropress/src/sqlite-runtime\n" +
				"  raise-baseline-batch --below 95\n" +
				"  raise-baseline-batch --new --fast",
		);
		return 1;
	}
	const fast = argv.includes("--fast");
	const filterArgs = argv.filter((a) => a !== "--fast");
	const targets = expandTargets(filterArgs);
	if (targets.length === 0) {
		console.log("raise-baseline-batch: no targets matched.");
		return 0;
	}
	console.log(
		`raise-baseline-batch: forwarding ${targets.length} file(s) to raise-baseline${
			fast ? " --fast" : ""
		}.`,
	);
	for (const t of targets) console.log(`  • ${t}`);
	const passthrough = [
		"run",
		join(REPO_ROOT, "tooling/scripts/raise-baseline.ts"),
		...(fast ? ["--fast"] : []),
		...targets,
	];
	const result = spawnSync("bun", passthrough, {
		cwd: REPO_ROOT,
		stdio: "inherit",
	});
	return result.status ?? 1;
}

process.exit(main());
