import { execSync, spawnSync } from "node:child_process";

const root = process.cwd();

function run(cmd: string, args: string[], cwd: string): number {
	const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
	if (result.error) throw result.error;
	return result.status ?? 1;
}

function runTier(
	label: string,
	steps: Array<{ cmd: string; args: string[]; cwd?: string }>,
): boolean {
	console.log(`\n${label}`);
	const start = process.hrtime.bigint();

	for (const step of steps) {
		const code = run(step.cmd, step.args, step.cwd ?? root);
		if (code !== 0) {
			const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
			console.error(
				`\n${label} FAILED (${elapsedMs.toFixed(0)}ms) — aborting pre-push gates`,
			);
			return false;
		}
	}

	const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
	console.log(`${label} passed (${elapsedMs.toFixed(0)}ms)`);
	return true;
}

function checkGhasAlerts(): boolean {
	const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
	if (!branch || branch === "main") return true;

	const result = spawnSync(
		"gh",
		[
			"api",
			`repos/Astropress/astropress/code-scanning/alerts?per_page=100&state=open`,
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

function main(): void {
	// Tier 0 — live GHAS alert check for current PR branch
	if (!checkGhasAlerts()) process.exit(1);

	// Tier 1 — targeted tests for committed files
	const tier1 = runTier("── pre-push tier 1: targeted (committed files) ──", [
		{
			cmd: "bun",
			args: ["run", "tooling/scripts/staged-tests.ts", "--committed"],
		},
	]);
	if (!tier1) process.exit(1);

	// Tier 2 — BDD suite (requires a fresh dist build so Rust tests use current JS)
	const tier2 = runTier("── pre-push tier 2: BDD suite ──", [
		{
			cmd: "bun",
			args: ["run", "--filter", "@astropress-diy/astropress", "build"],
		},
		{ cmd: "bun", args: ["run", "bdd:test"] },
	]);
	if (!tier2) process.exit(1);

	// Tier 3 — full coverage + integration
	const tier3 = runTier("── pre-push tier 3: full coverage + integration ──", [
		{
			cmd: "bun",
			args: [
				"run",
				"--filter",
				"@astropress-diy/astropress",
				"test:coverage:fast",
			],
		},
		{ cmd: "bun", args: ["run", "test:cli:smoke"] },
		{ cmd: "bun", args: ["run", "test:example"] },
		{ cmd: "bun", args: ["run", "repo:clean"] },
	]);
	if (!tier3) process.exit(1);

	console.log("\nAll pre-push gates passed.");
	process.exit(0);
}

main();
