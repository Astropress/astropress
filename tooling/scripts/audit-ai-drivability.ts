// Rubric 18 (AI Drivability)
/**
 * AI Drivability Audit
 *
 * Verifies that the repo meets AI-drivability requirements:
 *   1. AGENTS.md exists at repo root with key sections
 *   2. llms.txt exists at repo root
 *   3. MCP package exists (packages/astropress-mcp/package.json)
 *   4. platform-contracts.ts has sufficient JSDoc coverage (>= 20 blocks)
 *   5. api-middleware.ts contains no generic/banned error messages
 */

import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

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

  // 1. AGENTS.md exists and contains key sections
  const agentsMdPath = join(root, "AGENTS.md");
  if (!(await fileExists(agentsMdPath))) {
    violations.push("[agents-md-missing] AGENTS.md does not exist at repo root");
  } else {
    const content = await readFile(agentsMdPath, "utf8");
    const requiredSections = [
      "Key contracts",
      "arch-lint",
      "Security invariants",
      "No speculative features",
    ];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        violations.push(
          `[agents-md-section] AGENTS.md is missing required section: "${section}"`,
        );
      }
    }
  }

  // 2. llms.txt exists
  const llmsTxtPath = join(root, "llms.txt");
  if (!(await fileExists(llmsTxtPath))) {
    violations.push("[llms-txt-missing] llms.txt does not exist at repo root");
  }

  // 3. MCP package exists
  const mcpPkgPath = join(root, "packages/astropress-mcp/package.json");
  if (!(await fileExists(mcpPkgPath))) {
    violations.push(
      "[mcp-package-missing] packages/astropress-mcp/package.json does not exist",
    );
  }

  // 4. platform-contracts.ts has >= 20 JSDoc comment blocks
  const contractsPath = join(root, "packages/astropress/src/platform-contracts.ts");
  if (!(await fileExists(contractsPath))) {
    violations.push(
      "[contracts-missing] packages/astropress/src/platform-contracts.ts does not exist",
    );
  } else {
    const src = await readFile(contractsPath, "utf8");
    const lines = src.split("\n");
    const jsdocLineCount = lines.filter((line) =>
      /^\s*\/\*\*/.test(line) || /^\s*\*\s/.test(line),
    ).length;
    if (jsdocLineCount < 20) {
      violations.push(
        `[jsdoc-coverage] packages/astropress/src/platform-contracts.ts has only ${jsdocLineCount} JSDoc lines (need >= 20)`,
      );
    }
  }

  // 5. No generic error messages in api-middleware.ts
  const middlewarePath = join(root, "packages/astropress/src/api-middleware.ts");
  if (!(await fileExists(middlewarePath))) {
    violations.push(
      "[middleware-missing] packages/astropress/src/api-middleware.ts does not exist",
    );
  } else {
    const src = await readFile(middlewarePath, "utf8");
    const lines = src.split("\n");
    const bannedPhrases = [
      "Something went wrong",
      "An error occurred",
      "Unknown error",
      "Please try again",
    ];
    for (let i = 0; i < lines.length; i++) {
      for (const phrase of bannedPhrases) {
        if (lines[i].toLowerCase().includes(phrase.toLowerCase())) {
          violations.push(
            `[generic-error] packages/astropress/src/api-middleware.ts:${i + 1}: contains banned phrase "${phrase}"\n    → ${lines[i].trim()}`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `ai-drivability audit failed — ${violations.length} issue(s):\n`,
    );
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nFix: ensure AGENTS.md, llms.txt, and MCP package exist; add JSDoc to platform contracts; remove generic error messages.",
    );
    process.exit(1);
  }

  console.log("ai-drivability audit passed — all AI-drivability checks OK.");
}

main().catch((err) => {
  console.error("ai-drivability audit failed:", err);
  process.exit(1);
});
