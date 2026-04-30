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
 * Sentinel location: `${HOME}/.cache/astropress-lefthook-peer/failure-<ppid>`.
 * The directory is created with mode 0o700 so only the current user can read
 * or replace its contents — coordination via /tmp is unsafe because a local
 * attacker could pre-create a symlink at the predictable PID-derived path
 * to redirect or hijack writes (CodeQL js/insecure-temporary-file).
 *
 * Stale sentinels from prior pushes are not a concern: ppid is unique per
 * lefthook invocation. The very rare case of ppid reuse within the cache
 * dir's lifetime would just cause one bogus abort — harmless and
 * self-correcting (the user re-pushes).
 *
 * Usage:
 *   bun run tooling/scripts/run-with-peer-abort.ts <label> -- <cmd> [args...]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

const sentinelDir = join(homedir(), ".cache", "astropress-lefthook-peer");
mkdirSync(sentinelDir, { recursive: true, mode: 0o700 });
const sentinel = join(sentinelDir, `failure-${process.ppid}`);

// Pre-flight: peer already failed before we even started? Bail.
if (existsSync(sentinel)) {
	console.error(`⏭  ${label}: peer failed; skipping.`);
	process.exit(130);
}

// detached:true puts the child in its own process group so we can signal
// the entire tree (playwright server, stryker workers, dev servers spawned
// indirectly) by sending to -pid. Without this, SIGTERM/SIGKILL only hits
// the immediate child and grandchildren leak, leaving lefthook hung.
const child = spawn(cmd, cmdArgs, { stdio: "inherit", detached: true });
const childPid = child.pid;

const killGroup = (signal: NodeJS.Signals) => {
	if (childPid === undefined) return;
	try {
		process.kill(-childPid, signal);
	} catch {
		// group may already be gone — fall back to single-pid kill
		try {
			child.kill(signal);
		} catch {
			// best-effort
		}
	}
};

let aborted = false;
const poll = setInterval(() => {
	if (existsSync(sentinel) && !aborted) {
		aborted = true;
		console.error(`✖  ${label}: peer failed; aborting.`);
		killGroup("SIGTERM");
		// Don't wait for SIGTERM acknowledgement — escalate, then exit
		// regardless of whether grandchildren are still cleaning up.
		setTimeout(() => killGroup("SIGKILL"), 2000);
		setTimeout(() => process.exit(130), 4000);
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
