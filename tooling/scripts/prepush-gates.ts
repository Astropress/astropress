import { execSync, spawn, spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.cwd();

type Step = { name: string; cmd: string; args: string[]; cwd?: string };

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
		for (const f of failures) console.error(`  - ${f.step.name} exited ${f.code}`);
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
	const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
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

	console.error(`\n── GHAS alert check FAILED — open code-scanning alerts on ${branch}:`);
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
	console.log("── cold-cache wipe complete; gates will pay the fetch/build cost ──");
}

async function main(): Promise<void> {
	const overallStart = process.hrtime.bigint();

	maybeColdCacheWipe();

	// Tier 0 — live GHAS alert check for current PR branch
	if (!checkGhasAlerts()) process.exit(1);

	const docsOnly = isDocsOnlyPush();
	if (docsOnly) {
		console.log("\n── docs-only push detected (no .ts/.rs/.astro changes)");
		console.log("── skipping tiers 2 and 3; running tier 1 only as sanity check");
	}

	// Previous tier 1 ran `staged-tests --committed` which was effectively a
	// full Vitest + full `cargo test` on any branch with >25 file changes —
	// strictly redundant with tier 3's full Vitest suite. Pre-commit already
	// provides per-commit fail-fast via the same script. Deleted.

	if (docsOnly) {
		console.log(`\nAll pre-push gates passed (docs-only, ${fmtMs(Number(process.hrtime.bigint() - overallStart) / 1e6)}).`);
		process.exit(0);
	}

	// Build must come first — bdd:test imports compiled JS from dist/.
	// Vitest, cli:smoke, and test:example have no dist dependency.
	// Skip the build if dist/ is already newer than every file in src/.
	if (isBuildUpToDate()) {
		console.log("\n── build skipped (dist/ newer than src/; rerun bun run build manually if needed) ──");
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

	// Parallel: bdd:test (long pole, needs dist) + vitest + cli:smoke + test:example.
	// Merges what was formerly tier 2's bdd:test with tier 3; bdd sets the wall
	// clock and everything else hides behind it.
	const parallelSteps: Step[] = [
		{ name: "bdd:test", cmd: "bun", args: ["run", "bdd:test"] },
		{
			name: "vitest run (plain)",
			cmd: "bun",
			args: ["run", "--filter", "@astropress-diy/astropress", "test"],
		},
		{ name: "test:cli:smoke", cmd: "bun", args: ["run", "test:cli:smoke"] },
		{ name: "test:example", cmd: "bun", args: ["run", "test:example"] },
	];

	if (!(await runParallel("── tier 2/3 parallel ──", parallelSteps))) process.exit(1);

	// repo:clean must run last — it asserts no residual files from the parallel steps.
	if (
		!(await runSerial("── final gate ──", [
			{ name: "repo:clean", cmd: "bun", args: ["run", "repo:clean"] },
		]))
	) {
		process.exit(1);
	}

	const totalElapsed = Number(process.hrtime.bigint() - overallStart) / 1e6;
	console.log(`\nAll pre-push gates passed (${fmtMs(totalElapsed)}).`);
	process.exit(0);
}

main().catch((err) => {
	console.error("pre-push gates crashed:", err);
	process.exit(1);
});
