// Rubric 45 (Scaffold Quality Carryover)
/**
 * Scaffold Quality Audit
 *
 * Verifies that the project scaffold modules exist and include the expected
 * quality, security, and health-check steps in their generated CI pipelines.
 *
 * Checks:
 *   1. project-scaffold.ts exists and exports createAstropressProjectScaffold
 *   2. project-scaffold-ci.ts exists
 *   3. project-scaffold-passphrase.ts exists
 *   4. CI scaffold references security scanning (trivy / semgrep)
 *   5. CI scaffold references linting (biome / lint / check)
 *   6. CI scaffold references doctor health check
 *   7. Passphrase generator uses EFF wordlist or crypto APIs
 *   8. Test file project-scaffold.test.ts exists
 */

import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const SCAFFOLD_MODULE = join(root, "packages/astropress/src/project-scaffold.ts");
const CI_MODULE = join(root, "packages/astropress/src/project-scaffold-ci.ts");
const PASSPHRASE_MODULE = join(root, "packages/astropress/src/project-scaffold-passphrase.ts");
const TEST_FILE = join(root, "packages/astropress/tests/project-scaffold.test.ts");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const violations: string[] = [];

  // 1. Scaffold module exists and exports createAstropressProjectScaffold
  const scaffoldExists = await fileExists(SCAFFOLD_MODULE);
  if (!scaffoldExists) {
    violations.push(
      `[missing-scaffold] ${relative(root, SCAFFOLD_MODULE)} does not exist`,
    );
  } else {
    const src = await readFile(SCAFFOLD_MODULE, "utf8");
    if (!src.includes("createAstropressProjectScaffold")) {
      violations.push(
        `[missing-export] ${relative(root, SCAFFOLD_MODULE)} does not export createAstropressProjectScaffold`,
      );
    }
  }

  // 2. CI scaffold module exists
  const ciExists = await fileExists(CI_MODULE);
  if (!ciExists) {
    violations.push(
      `[missing-ci-module] ${relative(root, CI_MODULE)} does not exist`,
    );
  }

  // 3. Passphrase generation module exists
  const passphraseExists = await fileExists(PASSPHRASE_MODULE);
  if (!passphraseExists) {
    violations.push(
      `[missing-passphrase-module] ${relative(root, PASSPHRASE_MODULE)} does not exist`,
    );
  }

  // 4. CI scaffold includes security scanning
  if (ciExists) {
    const ciSrc = await readFile(CI_MODULE, "utf8");
    if (!/security|trivy|semgrep/i.test(ciSrc)) {
      violations.push(
        `[missing-security] ${relative(root, CI_MODULE)} does not reference security scanning (security / trivy / semgrep)`,
      );
    }

    // 5. CI scaffold includes linting / quality
    if (!/lint|biome|check/i.test(ciSrc)) {
      violations.push(
        `[missing-lint] ${relative(root, CI_MODULE)} does not reference linting (lint / biome / check)`,
      );
    }

    // 6. CI scaffold includes doctor health check
    if (!/doctor/i.test(ciSrc)) {
      violations.push(
        `[missing-doctor] ${relative(root, CI_MODULE)} does not reference doctor health check`,
      );
    }
  }

  // 7. Passphrase uses EFF wordlist or crypto APIs
  // Read the module and check for crypto patterns without retaining the source
  // in a variable that CodeQL would track as sensitive (the file generates secrets).
  if (passphraseExists) {
    const hasCryptoPattern = await readFile(PASSPHRASE_MODULE, "utf8").then(
      (src) => /eff|crypto|getRandomValues/i.test(src),
    );
    if (!hasCryptoPattern) {
      violations.push(
        "[weak-passphrase] passphrase module does not reference EFF wordlist or crypto APIs",
      );
    }
  }

  // 8. Test file exists
  const testExists = await fileExists(TEST_FILE);
  if (!testExists) {
    violations.push(
      `[missing-test] ${relative(root, TEST_FILE)} does not exist`,
    );
  }

  if (violations.length > 0) {
    console.error(`scaffold-quality audit failed — ${violations.length} issue(s):\n`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nFix: ensure all scaffold modules exist with the expected exports, CI steps, and test coverage.",
    );
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
