#!/usr/bin/env bun
/**
 * check-pr-ghas.ts
 *
 * Queries GHAS code-scanning alerts on the PR merge ref (refs/pull/<N>/merge)
 * for the current branch and exits non-zero if any are open.
 *
 * Usage:
 *   bun run tooling/scripts/check-pr-ghas.ts
 *   bun run tooling/scripts/check-pr-ghas.ts --pr 47
 *
 * Why this exists: the pre-push gate checks the branch ref
 * (refs/heads/<branch>), which can show 0 alerts while the PR merge ref
 * still shows open alerts from a stale scan. This script checks the ref
 * that the GitHub CodeQL gate actually evaluates.
 */

import { spawnSync } from "node:child_process";

function gh(args: string[]): { ok: boolean; stdout: string; stderr: string } {
	const result = spawnSync("gh", args, { encoding: "utf8" });
	return {
		ok: result.status === 0 && !result.error,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function resolvePrNumber(branch: string): number | null {
	const result = gh([
		"pr",
		"list",
		"--head",
		branch,
		"--state",
		"open",
		"--json",
		"number",
		"--jq",
		".[0].number",
	]);
	if (!result.ok) return null;
	const n = parseInt(result.stdout.trim(), 10);
	return Number.isFinite(n) ? n : null;
}

function getLatestAnalysis(prRef: string): {
	commit_sha: string;
	created_at: string;
} | null {
	const result = gh([
		"api",
		`repos/Astropress/astropress/code-scanning/analyses?ref=${prRef}&per_page=1`,
		"--jq",
		".[0] | {commit_sha, created_at}",
	]);
	if (!result.ok || !result.stdout.trim()) return null;
	try {
		return JSON.parse(result.stdout.trim()) as {
			commit_sha: string;
			created_at: string;
		};
	} catch {
		return null;
	}
}

function getOpenAlerts(prRef: string): string[] {
	const result = gh([
		"api",
		`repos/Astropress/astropress/code-scanning/alerts?ref=${prRef}&state=open&per_page=50`,
		"--jq",
		'.[] | "  #\\(.number)  \\(.rule.id)  \\(.most_recent_instance.location.path):\\(.most_recent_instance.location.start_line)"',
	]);
	if (!result.ok) return [];
	return result.stdout
		.trim()
		.split("\n")
		.filter((l) => l.trim());
}

function main(): void {
	const args = process.argv.slice(2);
	let prNumber: number | null = null;

	const prFlag = args.indexOf("--pr");
	if (prFlag !== -1 && args[prFlag + 1]) {
		prNumber = parseInt(args[prFlag + 1] as string, 10);
	}

	if (!prNumber) {
		const branch = spawnSync("git", ["branch", "--show-current"], {
			encoding: "utf8",
		}).stdout.trim();
		if (!branch || branch === "main") {
			console.log("Not on a feature branch — skipping PR GHAS check.");
			process.exit(0);
		}
		prNumber = resolvePrNumber(branch);
		if (!prNumber) {
			console.log("No open PR found for current branch — skipping.");
			process.exit(0);
		}
	}

	const prRef = `refs/pull/${prNumber}/merge`;
	console.log(`\nChecking GHAS alerts on ${prRef} (PR #${prNumber})…`);

	const analysis = getLatestAnalysis(prRef);
	if (analysis) {
		console.log(
			`  Latest scan: ${analysis.created_at}  commit ${analysis.commit_sha.slice(0, 8)}`,
		);
	} else {
		console.log("  No completed scan found yet for this PR merge ref.");
		process.exit(0);
	}

	const alerts = getOpenAlerts(prRef);
	if (alerts.length === 0) {
		console.log(`  ✓ No open GHAS alerts on ${prRef}`);
		process.exit(0);
	}

	console.error(`\n  GHAS alerts still open on ${prRef}:`);
	for (const a of alerts) console.error(a);
	console.error(
		"\n  Fix or suppress these alerts, then push and wait for a new scan.",
	);
	process.exit(1);
}

main();
