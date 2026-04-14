import { readFile, readdir, access } from "node:fs/promises";
import { join, relative } from "node:path";

// New audit: BDD Feature File Wiring
//
// Verifies that the BDD test framework has real, non-stub coverage for every
// feature scenario in tooling/bdd/**/*.feature:
//
//   1. Every Scenario: line in every .feature file has its exact text present
//      in tooling/scripts/bdd-test.ts (wired to a VerificationGroup)
//
//   2. Every VerificationGroup in bdd-test.ts has at least one step in its
//      `steps` array (no empty/stub groups that claim coverage but run nothing)
//
//   3. Every test file referenced in bdd-test.ts vitest steps actually exists
//      on disk (prevents wiring to deleted test files)

const root = process.cwd();
const BDD_ROOT = join(root, "tooling/bdd");
const BDD_TEST_TS = join(root, "tooling/scripts/bdd-test.ts");
const ASTROPRESS_PKG = join(root, "packages/astropress");
const NEXUS_PKG = join(root, "packages/astropress-nexus");

async function walkFeatureFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { recursive: true });
  for (const entry of entries) {
    if (entry.endsWith(".feature")) {
      files.push(join(dir, entry));
    }
  }
  return files.sort();
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const bddTestSrc = await readFile(BDD_TEST_TS, "utf8");
  const featureFiles = await walkFeatureFiles(BDD_ROOT);
  const violations: string[] = [];

  // ── Check 1: every scenario is wired ────────────────────────────────────────
  let totalScenarios = 0;
  let unwiredScenarios = 0;

  for (const featurePath of featureFiles) {
    const relPath = relative(root, featurePath);
    const src = await readFile(featurePath, "utf8");
    for (const line of src.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("Scenario:")) continue;
      const scenarioText = trimmed.slice("Scenario:".length).trim();
      totalScenarios++;

      // Also try the escaped-quotes form: `"c"` in a .feature file appears as `\"c\"` in bdd-test.ts
      const escapedScenarioText = scenarioText.replaceAll('"', '\\"');
      if (!bddTestSrc.includes(scenarioText) && !bddTestSrc.includes(escapedScenarioText)) {
        violations.push(
          `[unwired scenario] "${scenarioText}" — in ${relPath} but not found in bdd-test.ts`,
        );
        unwiredScenarios++;
      }
    }
  }

  // ── Check 2: no empty verification groups ───────────────────────────────────
  // Parse VerificationGroup-like blocks: look for `scenarios: [` ... `steps: [`
  // A group is "empty" if its steps array is `[]` or has no entries
  // Regex: steps: [ followed by optional whitespace then ]
  const emptyStepsPattern = /steps\s*:\s*\[\s*\]/g;
  let emptyGroupCount = 0;
  for (const m of bddTestSrc.matchAll(emptyStepsPattern)) {
    emptyGroupCount++;
    // Find the label of the enclosing group by searching backwards from match position
    const before = bddTestSrc.slice(0, m.index);
    const labelMatch = before.match(/label\s*:\s*["']([^"']+)["'][^{]*$/);
    const groupLabel = labelMatch ? labelMatch[1] : "(unknown group)";
    violations.push(
      `[empty verification group] "${groupLabel}" — has an empty steps: [] array. Add at least one test step.`,
    );
  }

  // ── Check 3: all referenced vitest test files exist ─────────────────────────
  // Pattern: "vitest", "run", "tests/foo.test.ts" (possibly more files in same array)
  // Also handle nexus tests that run from nexusPackageRoot
  const vitestFilePattern = /"tests\/([^"]+\.test\.ts)"/g;

  // We need to know the cwd context. The bdd-test.ts uses nexusPackageRoot for nexus tests.
  // Detect if a test file arg is preceded by nexusPackageRoot context.
  // Simple heuristic: if "nexusPackageRoot" appears within 200 chars before the reference, it's a nexus test.

  for (const m of bddTestSrc.matchAll(vitestFilePattern)) {
    const testRelPath = m[1];
    const matchPos = m.index ?? 0;

    // Check if this test reference is in a nexus step (within 500 chars, nexusPackageRoot or nexus appears)
    const context = bddTestSrc.slice(Math.max(0, matchPos - 500), matchPos + 200);
    const isNexusTest = context.includes("nexusPackageRoot") || context.includes("nexus");

    // The captured group is just the filename (e.g. "admin-ui.test.ts").
    // bdd-test.ts uses `args: ["vitest", "run", "tests/foo.test.ts"]` with cwd = package root,
    // so the actual file lives at <package>/tests/<filename>.
    const resolvedPath = isNexusTest
      ? join(NEXUS_PKG, "tests", testRelPath)
      : join(ASTROPRESS_PKG, "tests", testRelPath);

    if (!(await fileExists(resolvedPath))) {
      const rel = relative(root, resolvedPath);
      violations.push(
        `[missing test file] ${rel} — referenced in bdd-test.ts but does not exist on disk`,
      );
    }
  }

  if (violations.length > 0) {
    console.error(`bdd-wiring audit failed — ${violations.length} issue(s):\n`);
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `bdd-wiring audit passed — ${totalScenarios} scenarios across ${featureFiles.length} feature files: all wired, no empty groups, all referenced test files exist.`,
  );
}

main().catch((err) => {
  console.error("bdd-wiring audit failed:", err);
  process.exit(1);
});
