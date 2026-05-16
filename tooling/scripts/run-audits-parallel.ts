#!/usr/bin/env bun
/**
 * Run multiple `bun run <script>` audits concurrently and aggregate output.
 *
 * The lint CI job was 50+ sequential `bun run audit:*` steps (~47s wall).
 * Each audit is its own bun process with ~0.5-1s startup overhead, so
 * serialising them wastes most of the wall time on process boot. This
 * runner spawns up to `--concurrency` (default 8) at once, captures their
 * combined stdout/stderr, and emits a tidy summary at the end:
 *
 *   ✓ All 30 audits passed (max=4.2s, total-cpu=58.3s, wall=8.1s)
 *
 * On failure it prints each failing audit's captured output verbatim so
 * the CI log retains every diagnostic that the serial flow would have
 * surfaced, then exits with the OR'd exit code.
 */

import { spawn } from "node:child_process";
import { exit } from "node:process";

interface Result {
	script: string;
	code: number;
	output: string;
	durationMs: number;
}

interface Options {
	scripts: string[];
	concurrency: number;
}

function parseArgs(argv: string[]): Options {
	let concurrency = Number(process.env.AUDIT_CONCURRENCY ?? "8");
	const scripts: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--concurrency" || a === "-j") {
			concurrency = Number(argv[++i]);
		} else if (a.startsWith("--concurrency=")) {
			concurrency = Number(a.slice("--concurrency=".length));
		} else {
			scripts.push(a);
		}
	}
	if (!Number.isFinite(concurrency) || concurrency < 1) concurrency = 1;
	return { scripts, concurrency };
}

async function runOne(script: string): Promise<Result> {
	const t0 = Date.now();
	const child = spawn("bun", ["run", script], {
		stdio: ["ignore", "pipe", "pipe"],
		env: process.env,
	});
	let buf = "";
	child.stdout.on("data", (chunk: Buffer) => {
		buf += chunk.toString("utf8");
	});
	child.stderr.on("data", (chunk: Buffer) => {
		buf += chunk.toString("utf8");
	});
	const code = await new Promise<number>((resolve) => {
		child.on("exit", (c) => resolve(c ?? 0));
		child.on("error", () => resolve(1));
	});
	return { script, code, output: buf, durationMs: Date.now() - t0 };
}

const { scripts, concurrency } = parseArgs(process.argv.slice(2));
if (scripts.length === 0) {
	console.error("usage: run-audits-parallel.ts [--concurrency N] <script1> [script2 ...]");
	exit(2);
}

const wallStart = Date.now();
const results: Result[] = [];
let cursor = 0;
async function worker(): Promise<void> {
	while (true) {
		const i = cursor++;
		if (i >= scripts.length) return;
		const r = await runOne(scripts[i]);
		results.push(r);
		process.stdout.write(r.code === 0 ? "." : "x");
	}
}
await Promise.all(Array.from({ length: Math.min(concurrency, scripts.length) }, () => worker()));
process.stdout.write("\n");

const wallMs = Date.now() - wallStart;
const totalCpuMs = results.reduce((a, r) => a + r.durationMs, 0);
const maxMs = results.reduce((a, r) => Math.max(a, r.durationMs), 0);
const failed = results.filter((r) => r.code !== 0);
results.sort((a, b) => b.durationMs - a.durationMs);

if (failed.length === 0) {
	console.log(
		`✓ All ${results.length} audits passed (max=${(maxMs / 1000).toFixed(1)}s, total-cpu=${(totalCpuMs / 1000).toFixed(1)}s, wall=${(wallMs / 1000).toFixed(1)}s, concurrency=${concurrency})`,
	);
	for (const r of results.slice(0, 5)) {
		console.log(`  ${(r.durationMs / 1000).toFixed(2)}s  ${r.script}`);
	}
	if (results.length > 5) console.log(`  … ${results.length - 5} faster`);
	exit(0);
}

console.log(
	`✗ ${failed.length}/${results.length} audits failed (wall=${(wallMs / 1000).toFixed(1)}s)`,
);
for (const r of failed) {
	console.error(
		`\n──────── FAIL: ${r.script}  (exit ${r.code}, ${(r.durationMs / 1000).toFixed(2)}s) ────────`,
	);
	console.error(r.output.trimEnd());
}
exit(1);
