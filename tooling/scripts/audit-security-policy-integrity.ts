/**
 * Security Policy Integrity Audit — Rubric 57 (User-Facing Visual Integrity)
 *
 * Scans all user-facing source files for security-policy flags that must be
 * environment-aware rather than hardcoded booleans. Hardcoding these values
 * creates one of two failure modes:
 *
 *   1. `true` in production: relaxes CSP/security headers beyond what's needed,
 *      increasing attack surface (e.g. allowInlineStyles: true lets XSS via style
 *      injection in production).
 *
 *   2. `false` in development: blocks legitimate dev-time behavior (e.g. Vite's
 *      inline <style> injection), producing an unstyled/broken page that looks
 *      correct only in tests or production builds.
 *
 * The correct pattern is always `import.meta.env.DEV` — this is true during
 * `astro dev` and false in production builds.
 *
 * This generalizes the admin-only audit-csp-inline-styles.ts to cover:
 *   - All package source (src/, components/, pages/)
 *   - All example sites
 *   - Consumer smoke templates
 *
 * Flags checked:
 *   - allowInlineStyles: must not be literal true/false
 *   - allowInlineScripts: must not be literal true/false (future-proofing)
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const SCAN_DIRS = [
  join(root, "packages/astropress/src"),
  join(root, "packages/astropress/components"),
  join(root, "packages/astropress/pages"),
  join(root, "examples"),
];

const EXTENSIONS = new Set([".ts", ".astro", ".mjs", ".js"]);

// Security flags that must be keyed to import.meta.env.DEV, never hardcoded.
// Each entry: [flag name, regex for hardcoded true, regex for hardcoded false]
const ENV_AWARE_FLAGS: Array<[string, RegExp, RegExp]> = [
  [
    "allowInlineStyles",
    /allowInlineStyles\s*:\s*true\b/,
    /allowInlineStyles\s*:\s*false\b/,
  ],
  [
    "allowInlineScripts",
    /allowInlineScripts\s*:\s*true\b/,
    /allowInlineScripts\s*:\s*false\b/,
  ],
];

// Files that define the type/interface (they contain the default value in a
// type annotation or ?? fallback, not a call-site assignment).
const TYPE_DEFINITION_FILES = new Set([
  "security-headers.ts",
  "security-middleware.ts",
]);

// Test files are allowed to pass literal booleans (they're testing the function).
function isTestFile(path: string): boolean {
  return path.includes(".test.") || path.includes(".spec.") || path.includes("/tests/");
}

async function walkFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (EXTENSIONS.has(ext)) files.push(join(entry.parentPath, entry.name));
    }
  } catch { /* dir may not exist */ }
  return files.sort();
}

function isTypeDefinition(filePath: string): boolean {
  const filename = filePath.split("/").pop() ?? "";
  return TYPE_DEFINITION_FILES.has(filename);
}

async function main() {
  const violations: string[] = [];
  const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkFiles(d)));
  const files = allDirs.flat();

  for (const filePath of files) {
    if (isTestFile(filePath)) continue;
    if (isTypeDefinition(filePath)) continue;

    const relPath = relative(root, filePath);
    const src = await readFile(filePath, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const [flagName, truePattern, falsePattern] of ENV_AWARE_FLAGS) {
        if (truePattern.test(line)) {
          violations.push(
            `[hardcoded-true] ${relPath}:${i + 1}: ${flagName}: true — use import.meta.env.DEV instead\n    → ${line.trim()}`,
          );
        }
        if (falsePattern.test(line)) {
          violations.push(
            `[hardcoded-false] ${relPath}:${i + 1}: ${flagName}: false — use import.meta.env.DEV instead\n    → ${line.trim()}`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`security-policy-integrity audit failed — ${violations.length} issue(s) in ${files.length} files:\n`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nFix: replace hardcoded true/false with import.meta.env.DEV — " +
      "this allows relaxed policies in dev mode only, keeping production secure.",
    );
    process.exit(1);
  }

  console.log(
    `security-policy-integrity audit passed — ${files.length} files scanned, no hardcoded security-policy flags.`,
  );
}

main().catch((err) => {
  console.error("security-policy-integrity audit failed:", err);
  process.exit(1);
});
