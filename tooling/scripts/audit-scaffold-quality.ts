// Rubric 45 (Scaffold Quality Carryover)
/**
 * Scaffold Quality Audit
 *
 * Verifies that the project scaffold modules exist and include the expected
 * quality, security, and health-check steps in their generated CI pipelines.
 *
 * Note: the passphrase generation module is NOT checked here — CodeQL marks
 * any reference to it as sensitive. Its existence and crypto quality are
 * verified by project-scaffold.test.ts and audit:crypto instead.
 */

import { access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const root = process.cwd();

const SCAFFOLD_MODULE = join(root, "packages/astropress/src/project-scaffold.ts");
const CI_MODULE = join(root, "packages/astropress/src/project-scaffold-ci.ts");
const TEST_FILE = join(root, "packages/astropress/tests/project-scaffold.test.ts");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function grepQuiet(filePath: string, pattern: string): boolean {
  try {
    execFileSync("grep", ["-qiE", pattern, filePath], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let failed = false;

  function fail(tag: string, msg: string) {
    console.error(`  - [${tag}] ${msg}`);
    failed = true;
  }

  // 1. Scaffold module exists and exports createAstropressProjectScaffold
  if (!(await fileExists(SCAFFOLD_MODULE))) {
    fail("missing-scaffold", `${relative(root, SCAFFOLD_MODULE)} does not exist`);
  } else if (!grepQuiet(SCAFFOLD_MODULE, "createAstropressProjectScaffold")) {
    fail("missing-export", `${relative(root, SCAFFOLD_MODULE)} does not export createAstropressProjectScaffold`);
  }

  // 2. CI scaffold module exists
  const ciExists = await fileExists(CI_MODULE);
  if (!ciExists) {
    fail("missing-ci-module", `${relative(root, CI_MODULE)} does not exist`);
  }

  // 3. CI scaffold includes security scanning
  if (ciExists && !grepQuiet(CI_MODULE, "security|trivy|semgrep")) {
    fail("missing-security", `${relative(root, CI_MODULE)} does not reference security scanning`);
  }

  // 4. CI scaffold includes linting / quality
  if (ciExists && !grepQuiet(CI_MODULE, "lint|biome|check")) {
    fail("missing-lint", `${relative(root, CI_MODULE)} does not reference linting`);
  }

  // 5. CI scaffold includes doctor health check
  if (ciExists && !grepQuiet(CI_MODULE, "doctor")) {
    fail("missing-doctor", `${relative(root, CI_MODULE)} does not reference doctor health check`);
  }

  // 6. Test file exists
  if (!(await fileExists(TEST_FILE))) {
    fail("missing-test", `${relative(root, TEST_FILE)} does not exist`);
  }

  if (failed) {
    console.error("\nscaffold-quality audit failed. See issues above.");
    process.exit(1);
  }

  console.log(
    "scaffold-quality audit passed — all scaffold modules present with security, quality, and health-check coverage.",
  );
}

main().catch((err) => {
  console.error("scaffold-quality audit failed:", err);
  process.exit(1);
});
