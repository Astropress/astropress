import { spawnSync } from "node:child_process";

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

function main(): void {
  // Tier 1 — targeted tests for committed files
  const tier1 = runTier(
    "── pre-push tier 1: targeted (committed files) ──",
    [
      {
        cmd: "bun",
        args: ["run", "tooling/scripts/staged-tests.ts", "--committed"],
      },
    ],
  );
  if (!tier1) process.exit(1);

  // Tier 2 — BDD suite
  const tier2 = runTier("── pre-push tier 2: BDD suite ──", [
    { cmd: "bun", args: ["run", "bdd:test"] },
  ]);
  if (!tier2) process.exit(1);

  // Tier 3 — full coverage + integration
  const tier3 = runTier(
    "── pre-push tier 3: full coverage + integration ──",
    [
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
    ],
  );
  if (!tier3) process.exit(1);

  console.log("\nAll pre-push gates passed.");
  process.exit(0);
}

main();
