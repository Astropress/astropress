#!/usr/bin/env bun
/**
 * run-with-peer-abort — execute a command and abort if a peer command
 * (sibling under the same parent process) has already failed.
 *
 * lefthook's `parallel: true` runs sibling commands concurrently but does
 * not natively cancel the others when one fails. This wrapper provides
 * fail-fast behaviour by sharing a sentinel file keyed on the parent PID:
 *
 *   - On startup, check if /tmp/lefthook-peer-failure-<ppid> already exists.
 *     If so, a peer has failed — exit 130 immediately without running.
 *   - Spawn the wrapped command and poll the sentinel every 2s while it
 *     runs. If a peer writes the sentinel, SIGTERM the child, wait briefly,
 *     SIGKILL on stragglers, exit 130.
 *   - If the wrapped command fails, write the sentinel before exiting so
 *     subsequent peers abort.
 *   - If it succeeds, do not touch the sentinel — peers may still be
 *     running successfully.
 *
 * Stale sentinels from prior pushes are not a concern: ppid is unique per
 * lefthook invocation, and /tmp is wiped on reboot. The very rare case of
 * ppid reuse within a /tmp lifetime would just cause one bogus abort —
 * harmless and self-correcting (the user re-pushes).
 *
 * Usage:
 *   bun run tooling/scripts/run-with-peer-abort.ts <label> -- <cmd> [args...]
 */

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep === -1 || sep === 0 || sep === argv.length - 1) {
	console.error(
		"run-with-peer-abort: usage: run-with-peer-abort <label> -- <cmd> [args...]",
	);
	process.exit(2);
}

const label = argv.slice(0, sep).join(" ");
const [cmd, ...cmdArgs] = argv.slice(sep + 1);
if (!cmd) {
	console.error("run-with-peer-abort: missing command");
	process.exit(2);
}

const sentinel = `/tmp/lefthook-peer-failure-${process.ppid}`;

// Pre-flight: peer already failed before we even started? Bail.
if (existsSync(sentinel)) {
	console.error(`⏭  ${label}: peer failed; skipping.`);
	process.exit(130);
}

const child = spawn(cmd, cmdArgs, { stdio: "inherit" });

let aborted = false;
const poll = setInterval(() => {
	if (existsSync(sentinel) && !aborted) {
		aborted = true;
		console.error(`✖  ${label}: peer failed; aborting.`);
		// Graceful first, hard kill if it lingers past 5s.
		child.kill("SIGTERM");
		setTimeout(() => {
			if (!child.killed) child.kill("SIGKILL");
		}, 5000);
	}
}, 2000);

child.on("exit", (code, signal) => {
	clearInterval(poll);
	if (aborted) {
		process.exit(130);
	}
	if (code !== 0 || signal !== null) {
		try {
			writeFileSync(
				sentinel,
				JSON.stringify({
					failedLabel: label,
					at: new Date().toISOString(),
					pid: process.pid,
				}),
			);
		} catch {
			// best-effort — peers will run to completion if we can't write
		}
		process.exit(code ?? 1);
	}
	process.exit(0);
});

child.on("error", (err) => {
	clearInterval(poll);
	console.error(`✖  ${label}: spawn error: ${err.message}`);
	try {
		writeFileSync(
			sentinel,
			JSON.stringify({
				failedLabel: label,
				at: new Date().toISOString(),
				pid: process.pid,
				error: err.message,
			}),
		);
	} catch {
		// best-effort
	}
	process.exit(1);
});
