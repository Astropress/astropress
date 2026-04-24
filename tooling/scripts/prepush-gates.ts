import { execSync, spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { STEP_INPUTS, hashPaths } from "./step-content-hash";

const root = process.cwd();

type Step = { name: string; cmd: string; args: string[]; cwd?: string };

// ---------------------------------------------------------------------------
// Content-hash short-circuit cache
// ---------------------------------------------------------------------------
//
// Each heavy step declares the set of source paths it depends on (centralised
// in tooling/scripts/step-content-hash.ts so CI can share the same keys). We
// remember the last-green hash in .prepush-cache.json and skip any step
// whose input hash is unchanged since the last successful run.

const CACHE_PATH = join(root, ".prepush-cache.json");

interface CacheEntry {
	inputHash: string;
	lastGreenAt: string;
}

interface Cache {
	entries: Record<string, CacheEntry>;
}

function loadCache(): Cache {
	if (!existsSync(CACHE_PATH)) return { entries: {} };
	try {
		return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
	} catch {
		return { entries: {} };
	}
}

function saveCache(c: Cache): void {
	writeFileSync(CACHE_PATH, `${JSON.stringify(c, null, 2)}\n`);
}

/**
 * Returns true if every file under src/ is older than the newest artifact
 * under dist/. When this holds, rerunning `bun run build` produces the same
 * output and wastes ~20s. First push after a src/ edit still rebuilds.
 */
function isBuildUpToDate(): boolean {
	const srcDir = join(root, "packages/astropress/src");
	const distDir = join(root, "packages/astropress/dist");
	const walkNewest = (dir: string): number => {
		let newest = 0;
		try {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = join(dir, entry.name);
				if (entry.isDirectory()) {
					newest = Math.max(newest, walkNewest(full));
				} else {
					newest = Math.max(newest, statSync(full).mtimeMs);
				}
			}
		} catch {
			// missing dir — treat as not-ready
		}
		return newest;
	};
	const srcNewest = walkNewest(srcDir);
	const distNewest = walkNewest(distDir);
	if (srcNewest === 0 || distNewest === 0) return false;
	return distNewest >= srcNewest;
}

function fmtMs(ms: number): string {
	if (ms < 1_000) return `${ms.toFixed(0)}ms`;
	if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
	return `${(ms / 60_000).toFixed(1)}m`;
}

function runAsync(step: Step): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(step.cmd, step.args, {
			cwd: step.cwd ?? root,
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("close", (code) => resolve(code ?? 1));
	});
}

/**
 * Emit a "still running" heartbeat every 60s while any step in the group is
 * live. lefthook's `parallel: true` buffers stdout per hook until the hook
 * returns — without a heartbeat, a 5min gates hook shows no output for 5min
 * and users resort to pgrep to confirm it's alive. Heartbeat lines cost
 * nothing and go directly to stderr so they don't contaminate parseable
 * stdout.
 */
function startHeartbeat(label: string): () => void {
	const start = Date.now();
	const timer = setInterval(() => {
		const elapsed = (Date.now() - start) / 1000;
		const mm = Math.floor(elapsed / 60);
		const ss = Math.floor(elapsed % 60);
		process.stderr.write(
			`[heartbeat] ${label} still running (${mm}m ${ss.toString().padStart(2, "0")}s elapsed)\n`,
		);
	}, 60_000);
	timer.unref();
	return () => clearInterval(timer);
}

async function runParallel(label: string, steps: Step[]): Promise<boolean> {
	console.log(`\n${label}`);
	const start = process.hrtime.bigint();
	const stopHeartbeat = startHeartbeat(label);
	const results = await Promise.all(
		steps.map(async (step) => ({ step, code: await runAsync(step) })),
	);
	stopHeartbeat();
	const failures = results.filter((r) => r.code !== 0);
	const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
	if (failures.length > 0) {
		console.error(`\n${label} FAILED (${fmtMs(elapsed)})`);
		for (const f of failures)
			console.error(`  - ${f.step.name} exited ${f.code}`);
		return false;
	}
	console.log(`${label} passed (${fmtMs(elapsed)})`);
	return true;
}

async function runSerial(label: string, steps: Step[]): Promise<boolean> {
	console.log(`\n${label}`);
	const start = process.hrtime.bigint();
	const stopHeartbeat = startHeartbeat(label);
	for (const step of steps) {
		const code = await runAsync(step);
		if (code !== 0) {
			stopHeartbeat();
			const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
			console.error(`\n${label} FAILED on "${step.name}" (${fmtMs(elapsed)})`);
			return false;
		}
	}
	stopHeartbeat();
	const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
	console.log(`${label} passed (${fmtMs(elapsed)})`);
	return true;
}

function checkGhasAlerts(): boolean {
	const branch = execSync("git branch --show-current", {
		encoding: "utf8",
	}).trim();
	if (!branch || branch === "main") return true;

	const result = spawnSync(
		"gh",
		[
			"api",
			"repos/Astropress/astropress/code-scanning/alerts?per_page=100&state=open",
			"--jq",
			`.[] | select((.most_recent_instance.ref // "") | contains("${branch}")) | "  \\(.rule.id)  \\(.most_recent_instance.location.path):\\(.most_recent_instance.location.start_line)"`,
		],
		{ encoding: "utf8" },
	);

	if (result.status !== 0 || result.error) {
		console.log("\n── GHAS alert check: skipped (gh unavailable or API error)");
		return true;
	}

	const alerts = (result.stdout ?? "").trim();
	if (!alerts) {
		console.log(`\n── GHAS alert check: no open alerts on ${branch}`);
		return true;
	}

	console.error(
		`\n── GHAS alert check FAILED — open code-scanning alerts on ${branch}:`,
	);
	console.error(alerts);
	console.error("Fix or suppress these before pushing.");
	return false;
}

/**
 * If every file changed vs the default branch is documentation (markdown
 * under any directory or under docs/), the heavy tiers 2+3 gates don't
 * protect against anything the tier 1 targeted test run misses. Opt into
 * the fast-path automatically to unblock docs-only PRs.
 */
function isDocsOnlyPush(): boolean {
	let defaultRef = "origin/main";
	try {
		defaultRef =
			execSync("git symbolic-ref --short refs/remotes/origin/HEAD", {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim() || "origin/main";
	} catch {
		// fall through
	}
	let changed = "";
	try {
		const diff = spawnSync(
			"git",
			["diff", "--name-only", `${defaultRef}...HEAD`],
			{ encoding: "utf8" },
		);
		if (diff.status !== 0) return false;
		changed = (diff.stdout ?? "").trim();
	} catch {
		return false;
	}
	if (!changed) return false;
	const paths = changed.split("\n").filter(Boolean);
	return paths.every(
		(p) =>
			p.endsWith(".md") ||
			p.startsWith("docs/") ||
			p === "CHANGELOG.md" ||
			p === "README.md",
	);
}

/**
 * PREPUSH_COLD_CACHE=1 — emulate the CI environment where cargo's registry
 * cache, node_modules, and packages/astropress/dist are cold. The 2026-04-23
 * incident was a --offline flag that worked locally but broke CI. Running a
 * cold-cache push before merging any optimization catches this class of bug
 * before CI does.
 *
 * Opt-in: only runs when PREPUSH_COLD_CACHE=1 (not default — expensive).
 */
function maybeColdCacheWipe(): void {
	if (process.env.PREPUSH_COLD_CACHE !== "1") return;
	console.log("\n── PREPUSH_COLD_CACHE=1: wiping caches to emulate CI ──");
	const cargoCache = join(homedir(), ".cargo/registry/cache");
	const distDir = join(root, "packages/astropress/dist");
	const strykerTmp = join(root, ".stryker-tmp");
	const targets = [
		{ path: distDir, reason: "astropress build output" },
		{ path: strykerTmp, reason: "Stryker sandbox residue" },
		{ path: cargoCache, reason: "cargo registry cache" },
	];
	for (const t of targets) {
		try {
			rmSync(t.path, { recursive: true, force: true });
			console.log(`  wiped ${t.path} (${t.reason})`);
		} catch (err) {
			console.log(`  skipped ${t.path}: ${(err as Error).message}`);
		}
	}
	console.log(
		"── cold-cache wipe complete; gates will pay the fetch/build cost ──",
	);
}

async function main(): Promise<void> {
	const overallStart = process.hrtime.bigint();

	maybeColdCacheWipe();

	// Tier 0 — live GHAS alert check for current PR branch
	if (!checkGhasAlerts()) process.exit(1);

	const docsOnly = isDocsOnlyPush();
	if (docsOnly) {
		console.log("\n── docs-only push detected (no .ts/.rs/.astro changes)");
		console.log(
			"── skipping tiers 2 and 3; running tier 1 only as sanity check",
		);
	}

	if (docsOnly) {
		console.log(
			`\nAll pre-push gates passed (docs-only, ${fmtMs(Number(process.hrtime.bigint() - overallStart) / 1e6)}).`,
		);
		process.exit(0);
	}

	const cache = loadCache();
	const forceFull = process.env.PREPUSH_NO_CACHE === "1";
	if (forceFull)
		console.log("\n── PREPUSH_NO_CACHE=1: ignoring content-hash cache ──");

	// Build must come first — bdd:test imports compiled JS from dist/.
	if (isBuildUpToDate()) {
		console.log("\n── build skipped (dist/ newer than src/) ──");
	} else if (
		!(await runSerial("── build (tier 2 prologue) ──", [
			{
				name: "astropress build",
				cmd: "bun",
				args: ["run", "--filter", "@astropress-diy/astropress", "build"],
			},
		]))
	) {
		process.exit(1);
	}

	const parallelSteps: Step[] = [
		// Step names match CI job names so local and CI share STEP_INPUTS keys.
		{ name: "bdd:test", cmd: "bun", args: ["run", "bdd:test"] },
		{
			name: "test-unit",
			cmd: "bun",
			args: ["run", "--filter", "@astropress-diy/astropress", "test"],
		},
		{ name: "test:cli:smoke", cmd: "bun", args: ["run", "test:cli:smoke"] },
		{ name: "test-build-content", cmd: "bun", args: ["run", "test:example"] },
	];

	// Content-hash short-circuit: for each step, compute the hash of its
	// declared input paths and skip when it matches the cached last-green hash.
	const stepHashes: Record<string, string> = {};
	const toRun: Step[] = [];
	const skipped: string[] = [];
	for (const step of parallelSteps) {
		const inputs = STEP_INPUTS[step.name];
		if (!inputs || forceFull) {
			toRun.push(step);
			continue;
		}
		const inputHash = hashPaths(inputs);
		stepHashes[step.name] = inputHash;
		const prev = cache.entries[step.name];
		if (prev && prev.inputHash === inputHash) {
			skipped.push(`${step.name} (last green ${prev.lastGreenAt})`);
		} else {
			toRun.push(step);
		}
	}

	if (skipped.length > 0) {
		console.log("\n── content-hash cache ──");
		for (const s of skipped) console.log(`  skip  ${s}`);
	}

	if (toRun.length > 0) {
		if (!(await runParallel("── tier 2/3 parallel ──", toRun))) process.exit(1);
		// Only mark steps that actually ran green.
		for (const step of toRun) {
			const h = stepHashes[step.name];
			if (h)
				cache.entries[step.name] = {
					inputHash: h,
					lastGreenAt: new Date().toISOString(),
				};
		}
		saveCache(cache);
	} else {
		console.log(
			"\n── tier 2/3 parallel ── all steps cache-hit; nothing to run",
		);
	}

	// repo:clean must run last — but can itself cache-hit on an all-hit run
	// since no step wrote anything. Run it only if something ran, to also
	// validate the new artifacts.
	if (toRun.length > 0) {
		if (
			!(await runSerial("── final gate ──", [
				{ name: "repo:clean", cmd: "bun", args: ["run", "repo:clean"] },
			]))
		) {
			process.exit(1);
		}
	}

	const totalElapsed = Number(process.hrtime.bigint() - overallStart) / 1e6;
	console.log(`\nAll pre-push gates passed (${fmtMs(totalElapsed)}).`);
	process.exit(0);
}

main().catch((err) => {
	console.error("pre-push gates crashed:", err);
	process.exit(1);
});
