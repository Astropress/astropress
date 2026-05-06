import { execSync, spawn, spawnSync } from "node:child_process";
import {
	createWriteStream,
	existsSync,
	mkdirSync,
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

/**
 * Per-step log directory. Each step's stdout+stderr is tee'd here so that when
 * a peer SIGTERMs the failing step mid-write, the failure scrolls past in the
 * lefthook terminal but the FILE survives — and we can surface the path so
 * debugging takes seconds, not "re-run pre-push and hope".
 */
const PREPUSH_LOG_DIR = join(root, ".prepush-logs");

function ensureLogDir(): void {
	if (!existsSync(PREPUSH_LOG_DIR)) {
		mkdirSync(PREPUSH_LOG_DIR, { recursive: true });
	}
}

function logPathFor(stepName: string): string {
	const safe = stepName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
	return join(PREPUSH_LOG_DIR, `${safe}.log`);
}

function runAsync(step: Step): Promise<number> {
	return new Promise((resolve, reject) => {
		ensureLogDir();
		const file = logPathFor(step.name);
		const sink = createWriteStream(file, { flags: "w" });
		const child = spawn(step.cmd, step.args, {
			cwd: step.cwd ?? root,
			stdio: ["inherit", "pipe", "pipe"],
		});
		// Tee stdout+stderr to both the user's terminal and the per-step log.
		// `process.stdout.write` is sync-flush in node so SIGTERM mid-stream
		// still leaves a useful tail on disk.
		child.stdout?.on("data", (chunk: Buffer) => {
			process.stdout.write(chunk);
			sink.write(chunk);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			process.stderr.write(chunk);
			sink.write(chunk);
		});
		child.on("error", reject);
		child.on("close", (code) => {
			sink.end();
			resolve(code ?? 1);
		});
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
		for (const f of failures) {
			console.error(`  - ${f.step.name} exited ${f.code}`);
			console.error(`    full log: ${logPathFor(f.step.name)}`);
		}
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
			console.error(`  full log: ${logPathFor(step.name)}`);
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
 * Pre-push fast-path: detect when the diff against the default branch
 * is composed entirely of "test-irrelevant" files — markdown, the
 * generated `docs/reference/API_REFERENCE.md`, and Stryker baseline
 * scores. None of these can change runtime behaviour, so the heavy
 * tiers 2+3 gates don't add signal beyond the tier 1 audits. Opt into
 * the fast-path automatically to keep doc-fixup and baseline-bump
 * pushes off the ~6.5min gate budget.
 *
 * The allowlist is conservative — anything outside it falls through
 * to the full gate. The single load-bearing risk is misclassifying a
 * file that does affect runtime; review every addition here against
 * "could this break a test if changed in isolation?".
 */
function isTestIrrelevantOnlyPush(): boolean {
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
			p === "README.md" ||
			// Ratchet baselines and equivalence catalogs — audits enforce
			// their integrity at pre-commit, and they don't affect any
			// runtime path. A push that touches only these files is a
			// "rebaseline-only" push and need not re-fire the heavy gates.
			p === "tooling/stryker/baseline-scores.json" ||
			p === "tooling/stryker/equivalent-mutants.json" ||
			p === "tooling/audit-output/coverage-floor-baseline.json" ||
			p === "tooling/audit-output/source-test-pairing-baseline.json" ||
			p === "tooling/audit-output/boundary-types-baseline.json" ||
			p === "tooling/cargo-mutants/baseline-scores.json",
	);
}

/** @deprecated kept as an alias to preserve the old log message. */
function isDocsOnlyPush(): boolean {
	return isTestIrrelevantOnlyPush();
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

	// Snapshot the worktree at gate start so the final repo:clean check
	// can report files that *appeared during* the run (mid-gate edits by
	// an editor/agent) separately from pre-existing dirt.
	const snapshotPath = join(root, ".prepush-worktree-snapshot");
	try {
		spawnSync(
			"bun",
			[
				"run",
				"tooling/scripts/assert-clean-worktree.ts",
				"--snapshot",
				snapshotPath,
			],
			{ stdio: "ignore" },
		);
	} catch {
		// Snapshot is best-effort — if it fails, the final repo:clean
		// still works without diff context.
	}

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
			// Runs with coverage so the follow-up audit:coverage-floor step
			// can read packages/astropress/coverage/coverage-summary.json. The
			// v8 instrumentation overhead is ~30-60s but it catches per-file
			// coverage regressions locally instead of in CI.
			name: "test-unit",
			cmd: "bun",
			args: ["run", "--filter", "@astropress-diy/astropress", "test:coverage"],
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

	// audit:coverage-floor must follow test-unit so coverage-summary.json
	// is fresh. Catches per-file v8 coverage regressions locally that would
	// otherwise only surface in the CI lint job (post-push). Also runs
	// audit:deps to catch transitive dep advisories that pre-commit misses
	// when package.json is unchanged on a branch.
	if (toRun.some((s) => s.name === "test-unit")) {
		if (
			!(await runSerial("── post-tests audits ──", [
				{
					name: "audit:coverage-floor",
					cmd: "bun",
					args: ["run", "audit:coverage-floor"],
				},
				{ name: "audit:deps", cmd: "bun", args: ["run", "audit:deps"] },
			]))
		) {
			process.exit(1);
		}
	}

	// repo:clean must run last — but can itself cache-hit on an all-hit run
	// since no step wrote anything. Run it only if something ran, to also
	// validate the new artifacts. Pass the gate-start snapshot so a
	// mid-gate-added file is surfaced clearly instead of conflated with
	// pre-existing local dirt.
	if (toRun.length > 0) {
		if (
			!(await runSerial("── final gate ──", [
				{
					name: "repo:clean",
					cmd: "bun",
					args: [
						"run",
						"tooling/scripts/assert-clean-worktree.ts",
						"--against",
						snapshotPath,
					],
				},
			]))
		) {
			process.exit(1);
		}
	}

	// Snapshot file is per-push; clean up so it doesn't linger in the worktree.
	try {
		rmSync(snapshotPath, { force: true });
	} catch {
		// best-effort
	}

	const totalElapsed = Number(process.hrtime.bigint() - overallStart) / 1e6;
	console.log(`\nAll pre-push gates passed (${fmtMs(totalElapsed)}).`);
	process.exit(0);
}

main().catch((err) => {
	console.error("pre-push gates crashed:", err);
	process.exit(1);
});
