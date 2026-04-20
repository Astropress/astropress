import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const pkgDir = join(root, "packages/astropress");

const DEFAULT_PATHS = [
  "packages/astropress/src",
  "packages/astropress/tests",
  "packages/astropress/web-components",
];

function run(cmd: string, args: string[], cwd: string): number {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function gitDiffNames(): string[] {
  const result = spawnSync("git", ["diff", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });
  return (result.stdout ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function main(): void {
  const paths =
    process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_PATHS;

  console.log("── biome unsafe write ──");
  console.log(`Paths: ${paths.join(", ")}`);

  const biomeCode = run(
    "bunx",
    ["@biomejs/biome@1", "check", "--write", "--unsafe", ...paths],
    root,
  );

  const modified = gitDiffNames();
  console.log(
    `Modified files: ${modified.length > 0 ? modified.length : 0}`,
  );

  if (biomeCode !== 0) {
    process.exit(biomeCode);
  }

  console.log(
    "── smoke test (verifying unsafe fixes didn't break anything) ──",
  );

  const vitestCode = run("bunx", ["vitest", "run"], pkgDir);

  if (vitestCode !== 0) {
    console.error("");
    console.error(
      "x Unsafe fixes broke tests. Review the diff before staging:",
    );
    console.error("  git diff packages/");
    console.error("");
    process.exit(1);
  }

  console.log("v Unsafe fixes verified. Review and stage:");
  const finalModified = gitDiffNames();
  if (finalModified.length > 0) {
    for (const f of finalModified) {
      console.log(`  ${f}`);
    }
  } else {
    console.log("  (no unstaged changes)");
  }

  process.exit(0);
}

main();
