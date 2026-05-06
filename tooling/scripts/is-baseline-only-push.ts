#!/usr/bin/env bun
/**
 * is-baseline-only-push — detect whether the only changes between the
 * remote-tracking branch and HEAD are in the safelist (mutation-gate
 * baseline + paired test files). Used by prepush gates to short-circuit
 * when a string of "rebaseline-only" commits would otherwise re-fire the
 * full ~7-minute suite on every push.
 *
 * The safelist:
 *   - tooling/stryker/baseline-scores.json (raise-baseline output)
 *   - tooling/stryker/equivalent-mutants.json (catalog edits)
 *   - tooling/audit-output/coverage-floor-baseline.json (coverage ratchet)
 *   - tooling/audit-output/source-test-pairing-baseline.json
 *   - tooling/cargo-mutants/baseline-scores.json
 *   - packages/**​/tests/**​/*.test.ts (paired test files)
 *
 * If ANY changed path falls outside the safelist, the function returns
 * false — heavy gates run. This is intentionally conservative: a missed
 * src/ change must never silently skip the gate.
 *
 * CLI: `bun run tooling/scripts/is-baseline-only-push.ts` exits 0 if
 *      safelist-only, 1 otherwise. Suitable for shell short-circuiting:
 *      `bun run is-baseline-only-push.ts || bun run heavy-step.ts`
 */

import { spawnSync } from "node:child_process";

const SAFE_EXACT = new Set([
	"tooling/stryker/baseline-scores.json",
	"tooling/stryker/equivalent-mutants.json",
	"tooling/audit-output/coverage-floor-baseline.json",
	"tooling/audit-output/source-test-pairing-baseline.json",
	"tooling/cargo-mutants/baseline-scores.json",
]);

function isSafePath(path: string): boolean {
	if (SAFE_EXACT.has(path)) return true;
	// Paired test files under packages/*/tests/**/*.test.ts.
	if (
		/^packages\/[^/]+\/tests\/.+\.test\.ts$/.test(path) &&
		!path.includes("..")
	) {
		return true;
	}
	return false;
}

function changedPathsSinceUpstream(): string[] | null {
	// Try LEFTHOOK_HEAD_BEFORE first (the SHA the remote saw before this
	// push); fall back to origin/<current-branch> when running outside a
	// pre-push hook.
	const headBefore = process.env.LEFTHOOK_HEAD_BEFORE;
	let base =
		headBefore && headBefore !== "0000000000000000000000000000000000000000"
			? headBefore
			: "";
	if (!base) {
		const upstream = spawnSync(
			"git",
			["rev-parse", "--abbrev-ref", "@{upstream}"],
			{ encoding: "utf8" },
		);
		if (upstream.status !== 0) return null;
		base = upstream.stdout.trim();
	}
	const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
		encoding: "utf8",
	});
	if (diff.status !== 0) return null;
	return diff.stdout
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isBaselineOnlyPush(): {
	ok: boolean;
	reason: string;
	paths: string[];
} {
	const paths = changedPathsSinceUpstream();
	if (!paths) {
		return {
			ok: false,
			reason: "could not determine changed paths (no upstream / detached HEAD)",
			paths: [],
		};
	}
	if (paths.length === 0) {
		return { ok: true, reason: "no changed paths since upstream", paths };
	}
	const offenders = paths.filter((p) => !isSafePath(p));
	if (offenders.length === 0) {
		return { ok: true, reason: "every changed path is in the safelist", paths };
	}
	return {
		ok: false,
		reason: `${offenders.length} path(s) outside the safelist: ${offenders
			.slice(0, 5)
			.join(", ")}${offenders.length > 5 ? ", …" : ""}`,
		paths,
	};
}

if (import.meta.main) {
	const result = isBaselineOnlyPush();
	if (result.ok) {
		console.log(`is-baseline-only-push: skip OK (${result.reason}).`);
		process.exit(0);
	}
	console.log(`is-baseline-only-push: do not skip — ${result.reason}.`);
	process.exit(1);
}
