import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

const THRESHOLD = 25;
const root = process.cwd();
const pkgDir = join(root, "packages/astropress");

function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.stdout ?? "";
}

function changedFiles(committed: boolean): string[] {
  if (committed) {
    const upstream = git(
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ).trim() || "origin/HEAD";
    const range = `${upstream}..HEAD`;
    return git("diff", range, "--name-only")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  }
  return git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function resolveTestFile(srcFile: string): string | null {
  // srcFile is relative to repo root, e.g. packages/astropress/src/foo/bar.ts
  const rel = srcFile.replace(/^packages\/astropress\/src\//, "");
  // Exact match: tests/foo/bar.test.ts
  const exactPath = join(pkgDir, "tests", rel.replace(/\.ts$/, ".test.ts"));
  if (existsSync(exactPath)) return exactPath;
  // Stem match: tests/<basename>.test.ts
  const stem = basename(rel, ".ts");
  const stemPath = join(pkgDir, "tests", `${stem}.test.ts`);
  if (existsSync(stemPath)) return stemPath;
  return null;
}

function run(cmd: string, args: string[], cwd: string): number {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main(): void {
  const committed = process.argv.includes("--committed");
  const files = changedFiles(committed);

  const sourceFiles: string[] = [];
  const directTestFiles: string[] = [];
  const rustFiles: string[] = [];

  for (const f of files) {
    if (f.startsWith("crates/") && f.endsWith(".rs")) {
      rustFiles.push(f);
    } else if (
      (f.startsWith("packages/astropress/tests/") ||
        f.startsWith("packages/astropress/web-components/")) &&
      f.endsWith(".ts")
    ) {
      directTestFiles.push(join(root, f));
    } else if (
      f.startsWith("packages/astropress/src/") &&
      f.endsWith(".ts")
    ) {
      sourceFiles.push(f);
    }
  }

  // Map web-component source files to their test files
  const webComponentTestFiles: string[] = [];
  for (const f of files) {
    if (
      f.startsWith("packages/astropress/web-components/") &&
      f.endsWith(".ts")
    ) {
      const stem = basename(f, ".ts");
      const testPath = join(pkgDir, "tests", "web-components", `${stem}.test.ts`);
      if (existsSync(testPath)) {
        webComponentTestFiles.push(testPath);
      }
    }
  }

  const resolvedTestFiles = new Set<string>(directTestFiles);
  for (const wc of webComponentTestFiles) resolvedTestFiles.add(wc);

  if (sourceFiles.length > THRESHOLD) {
    console.log(
      `── staged-tests: ${sourceFiles.length} source files exceeds threshold (${THRESHOLD}) → full suite ──`,
    );
  } else {
    for (const src of sourceFiles) {
      const testFile = resolveTestFile(src);
      if (testFile) resolvedTestFiles.add(testFile);
    }
  }

  const testFileList = [...resolvedTestFiles];
  const hasTests = testFileList.length > 0;
  const hasRust = rustFiles.length > 0;

  if (!hasTests && !hasRust) {
    process.exit(0);
  }

  let exitCode = 0;

  if (hasTests) {
    if (sourceFiles.length > THRESHOLD) {
      console.log(`Running: vitest run (full suite)`);
      const code = run("bunx", ["vitest", "run"], pkgDir);
      if (code !== 0) exitCode = code;
    } else {
      const relPaths = testFileList.map((f) => f.replace(pkgDir + "/", ""));
      console.log(
        `── staged-tests: ${sourceFiles.length} source files → ${testFileList.length} test files ──`,
      );
      console.log(`Running: vitest run ${relPaths.join(" ")}`);
      const code = run("bunx", ["vitest", "run", ...testFileList], pkgDir);
      if (code !== 0) exitCode = code;
    }
  }

  if (hasRust) {
    console.log(`── staged-tests: running cargo test (Rust files changed) ──`);
    const code = run("cargo", [
      "test",
      "--offline",
      "--manifest-path",
      "crates/Cargo.toml",
    ], root);
    if (code !== 0) exitCode = code;
  }

  process.exit(exitCode);
}

main();
