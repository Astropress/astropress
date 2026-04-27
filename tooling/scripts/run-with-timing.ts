#!/usr/bin/env bun
/**
 * run-with-timing — execute an arbitrary command and report wall-clock
 * duration to stderr at completion. Use this to wrap lefthook steps whose
 * displayed duration is unreliable (lefthook reports start-time-based numbers
 * for parallel steps, which can read as e.g. 0.26s for a step that actually
 * ran for 10 minutes).
 *
 * Usage:
 *   bun run tooling/scripts/run-with-timing.ts <label> -- <cmd> [args...]
 *
 * Example:
 *   bun run tooling/scripts/run-with-timing.ts mutation-gate -- bun run tooling/scripts/prepush-mutation-gate.ts
 *
 * Exits with the wrapped command's exit code. The timing line goes to stderr
 * so it does not pollute stdout-consuming pipelines.
 */

import { spawnSync } from "node:child_process";

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(2)}s`;
	const m = Math.floor(s / 60);
	const rs = (s - m * 60).toFixed(0);
	return `${m}m${rs}s`;
}

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep === -1 || sep === 0 || sep === argv.length - 1) {
	console.error(
		"run-with-timing: usage: run-with-timing <label> -- <cmd> [args...]",
	);
	process.exit(2);
}

const label = argv.slice(0, sep).join(" ");
const [cmd, ...cmdArgs] = argv.slice(sep + 1);

const start = Date.now();
const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
const elapsed = Date.now() - start;

const status = result.status === 0 ? "ok" : `exit ${result.status}`;
console.error(`⏱  ${label}: ${formatDuration(elapsed)} (${status})`);

process.exit(result.status ?? 1);
