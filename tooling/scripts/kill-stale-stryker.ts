import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

// Manually triggered cleanup for zombie Stryker runs.
//
//   bun run clean:stryker [--older-than-minutes=N]
//
// Finds two kinds of residue:
//   1. Stryker child-process-proxy workers older than N minutes (default 120)
//   2. .stryker-tmp/sandbox-* directories older than N minutes
//
// Kills the processes with SIGTERM, waits 2s, then SIGKILL survivors.
// Removes the sandbox dirs. Never touches anything younger than the cutoff.

const DEFAULT_MINUTES = 120;

function parseArgs(): { minutes: number; dryRun: boolean } {
	const args = process.argv.slice(2);
	let minutes = DEFAULT_MINUTES;
	let dryRun = false;
	for (const arg of args) {
		if (arg === "--dry-run") dryRun = true;
		else if (arg.startsWith("--older-than-minutes=")) {
			const v = Number.parseInt(arg.split("=")[1], 10);
			if (!Number.isNaN(v) && v > 0) minutes = v;
		}
	}
	return { minutes, dryRun };
}

interface PsEntry {
	pid: number;
	etimeSec: number;
	cmd: string;
}

function listStrykerProcesses(): PsEntry[] {
	// etime format from `ps -o etimes` is seconds. Use BSD/Linux compatible flags.
	const out = spawnSync(
		"ps",
		["-eo", "pid,etimes,command", "--no-headers"],
		{ encoding: "utf8" },
	);
	if (out.status !== 0) return [];
	return out.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.filter(
			(line) =>
				line.includes("stryker-mutator") ||
				line.includes("child-process-proxy-worker") ||
				line.includes("stryker/core"),
		)
		.map<PsEntry>((line) => {
			const parts = line.split(/\s+/);
			const pid = Number.parseInt(parts[0], 10);
			const etimes = Number.parseInt(parts[1], 10);
			const cmd = parts.slice(2).join(" ");
			return { pid, etimeSec: etimes, cmd };
		})
		.filter((e) => Number.isFinite(e.pid) && Number.isFinite(e.etimeSec));
}

function killPid(pid: number, signal: string): boolean {
	try {
		process.kill(pid, signal as NodeJS.Signals);
		return true;
	} catch {
		return false;
	}
}

function cleanSandboxes(root: string, minutes: number, dryRun: boolean): number {
	const tmpDir = join(root, ".stryker-tmp");
	let removed = 0;
	try {
		const cutoffMs = Date.now() - minutes * 60 * 1000;
		for (const entry of readdirSync(tmpDir, { withFileTypes: true })) {
			if (!entry.isDirectory() || !entry.name.startsWith("sandbox-")) continue;
			const full = join(tmpDir, entry.name);
			const stat = statSync(full);
			if (stat.mtimeMs < cutoffMs) {
				if (dryRun) {
					console.log(`[dry-run] would rm -rf ${full}`);
				} else {
					rmSync(full, { recursive: true, force: true });
					console.log(`removed ${full}`);
				}
				removed++;
			}
		}
	} catch {
		// .stryker-tmp may not exist; that's fine.
	}
	return removed;
}

function main(): void {
	const { minutes, dryRun } = parseArgs();
	const cutoffSec = minutes * 60;

	const candidates = listStrykerProcesses().filter((p) => p.etimeSec >= cutoffSec);
	if (candidates.length === 0) {
		console.log(`no Stryker processes older than ${minutes}m`);
	} else {
		console.log(
			`found ${candidates.length} Stryker process(es) older than ${minutes}m:`,
		);
		for (const p of candidates) {
			console.log(`  pid=${p.pid}  age=${Math.round(p.etimeSec / 60)}m  ${p.cmd.slice(0, 80)}`);
		}
		if (!dryRun) {
			for (const p of candidates) killPid(p.pid, "SIGTERM");
			// Give graceful shutdown 2s
			const deadline = Date.now() + 2_000;
			while (Date.now() < deadline) {
				// busy-wait; 2s is the whole budget
				const remaining = listStrykerProcesses().filter(
					(p) => candidates.some((c) => c.pid === p.pid) && p.etimeSec >= cutoffSec,
				);
				if (remaining.length === 0) break;
			}
			for (const p of candidates) killPid(p.pid, "SIGKILL");
			console.log(`sent SIGTERM+SIGKILL to ${candidates.length} process(es)`);
		}
	}

	const removed = cleanSandboxes(process.cwd(), minutes, dryRun);
	if (removed === 0) console.log(`no stale .stryker-tmp/sandbox-* dirs`);
}

main();
