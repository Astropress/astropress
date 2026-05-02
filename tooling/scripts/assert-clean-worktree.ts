/**
 * Asserts the git worktree is clean.
 *
 * When `--snapshot <file>` is passed, writes the current `git status
 * --porcelain` output to that file and exits. The pre-push gate calls
 * this once at gate start so the final `repo:clean` invocation can
 * tell "files appeared mid-gate" apart from "files were already there"
 * — the prior failure mode confused mid-gate file additions (e.g. an
 * editor agent writing new sources while the gate ran for ~6min) with
 * a normal dirty-worktree fail.
 *
 * When `--against <file>` is passed and the snapshot exists, the
 * dirty-worktree error includes a "files added since gate start" list
 * so the operator immediately sees what changed.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function readArg(flag: string): string | undefined {
	const i = process.argv.indexOf(flag);
	if (i < 0) return undefined;
	return process.argv[i + 1];
}

function porcelain(): string {
	return execFileSync("git", ["status", "--porcelain"], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
}

function diffLines(before: string, after: string): string[] {
	const beforeSet = new Set(
		before
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean),
	);
	return after
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !beforeSet.has(l));
}

function main() {
	const snapshotPath = readArg("--snapshot");
	const againstPath = readArg("--against");

	if (snapshotPath !== undefined) {
		writeFileSync(snapshotPath, porcelain(), "utf8");
		console.log(`worktree snapshot written to ${snapshotPath}`);
		return;
	}

	const status = porcelain().trim();

	if (status.length === 0) {
		console.log("worktree is clean.");
		return;
	}

	console.error("worktree is dirty after verification:\n");
	console.error(status);

	if (againstPath !== undefined && existsSync(againstPath)) {
		const before = readFileSync(againstPath, "utf8");
		const newOnly = diffLines(before, status);
		if (newOnly.length > 0) {
			console.error(
				"\nFiles that appeared *during* this verification run (most likely cause):\n",
			);
			for (const line of newOnly) console.error(`  ${line}`);
			console.error(
				"\nIf an editor / agent added these mid-gate, stage and commit them, then re-push.",
			);
		}
	}

	process.exit(1);
}

main();
