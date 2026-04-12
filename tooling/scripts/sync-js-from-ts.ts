/**
 * Regenerate the compiled .js files in packages/astropress/src/ from their
 * TypeScript source (.ts) counterparts.
 *
 * This is a convenience wrapper around the existing build pipeline:
 *   tsc -p packages/astropress/tsconfig.build.json --noCheck
 *   bun tooling/scripts/add-js-ext.ts src
 *
 * Use it when you have edited one or more .ts files and need the paired .js
 * files to reflect those changes before committing. Running `bun run build`
 * inside `packages/astropress/` does the same thing — this script just
 * provides a single command from the repo root.
 *
 * After running, verify with:
 *   bun run audit:sync
 *
 * Usage (from repo root):
 *   bun run tooling/scripts/sync-js-from-ts.ts
 *   bun run sync:js           # via package.json script alias
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const pkgDir = path.join(repoRoot, "packages", "astropress");
const tsconfigPath = path.join(pkgDir, "tsconfig.build.json");
const addJsExtScript = path.join(repoRoot, "tooling", "scripts", "add-js-ext.ts");

if (!existsSync(tsconfigPath)) {
  console.error(`tsconfig.build.json not found at ${tsconfigPath}`);
  process.exit(1);
}

if (!existsSync(addJsExtScript)) {
  console.error(`add-js-ext.ts not found at ${addJsExtScript}`);
  process.exit(1);
}

// Resolve bun and tsc
function which(cmd: string): string {
  const result = spawnSync("which", [cmd], { encoding: "utf8" });
  return result.stdout.trim();
}

const bunBin = which("bun") || "bun";

function run(cmd: string, args: string[], cwd?: string): void {
  const label = [cmd, ...args].join(" ");
  console.log(`  → ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: cwd ?? repoRoot,
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  if (result.status !== 0) {
    console.error(`\nCommand failed (exit ${result.status ?? "null"}): ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("Regenerating .js files from TypeScript source…\n");

// Step 1: compile .ts → .js (emit only, no type checking)
run(bunBin, ["x", "tsc", "-p", tsconfigPath, "--noCheck"], repoRoot);

// Step 2: rewrite import extensions in emitted .js files
run(bunBin, [addJsExtScript, "src"], pkgDir);

console.log("\nDone. Run `bun run audit:sync` to verify parity.");
