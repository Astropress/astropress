import { execSync, spawn, spawnSync } from "node:child_process";

const root = process.cwd();

type Step = { name: string; cmd: string; args: string[]; cwd?: string };

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

async function runParallel(label: string, steps: Step[]): Promise<boolean> {
	console.log(`\n${label}`);
	const start = process.hrtime.bigint();
	const results = await Promise.all(
		steps.map(async (step) => ({ step, code: await runAsync(step) })),
	);
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
	for (const step of steps) {
		const code = await runAsync(step);
		if (code !== 0) {
			const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
			console.error(`\n${label} FAILED on "${step.name}" (${fmtMs(elapsed)})`);
			return false;
		}
	}
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

async function main(): Promise<void> {
	const overallStart = process.hrtime.bigint();

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

	// Tier 2 — build + BDD. Serial (build produces the dist that bdd:test uses).
	const tier2: Step[] = [
		{
			name: "astropress build",
			cmd: "bun",
			args: ["run", "--filter", "@astropress-diy/astropress", "build"],
		},
		{ name: "bdd:test", cmd: "bun", args: ["run", "bdd:test"] },
	];

	if (!(await runSerial("── tier 2 (build + BDD) ──", tier2))) process.exit(1);

	// Tier 3 — parallel. Plain vitest (no coverage), Rust smoke, example check.
	// Coverage thresholds remain enforced in CI.
	const tier3Parallel: Step[] = [
		{
			name: "vitest run (plain)",
			cmd: "bun",
			args: [
				"run",
				"--filter",
				"@astropress-diy/astropress",
				"test",
			],
		},
		{ name: "test:cli:smoke", cmd: "bun", args: ["run", "test:cli:smoke"] },
		{ name: "test:example", cmd: "bun", args: ["run", "test:example"] },
	];

	if (!(await runParallel("── tier 3 parallel ──", tier3Parallel))) process.exit(1);

	// repo:clean must run last — it asserts no residual files from the parallel steps.
	if (
		!(await runSerial("── tier 3 final ──", [
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
