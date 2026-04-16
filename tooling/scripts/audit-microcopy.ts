import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const auditableExtensions = new Set([".md", ".mdx", ".astro", ".ts", ".tsx", ".rs"]);
const bannedPhrases = [
  "Something went wrong. Please try again.",
  "An error occurred",
  "Failed to subscribe. Please try again.",
  "Network error. Please try again.",
];
const allowedFiles = new Set([
  "tooling/scripts/audit-microcopy.ts",   // defines the banned phrases themselves
  "tooling/scripts/audit-ai-drivability.ts", // checks API for banned error messages
  "docs/reference/EVALUATION.md",         // describes banned phrases as UX criteria examples
  "docs/UX_WRITING.md",
  "AGENTS.md",                            // documents the audit rules for contributors
]);

function isAuditableFile(file: string) {
  return [...auditableExtensions].some((ext) => file.endsWith(ext));
}

async function main() {
  const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter((file) => file.length > 0)
    .filter((file) => !file.startsWith("node_modules/") && isAuditableFile(file));

  const violations: string[] = [];

  for (const file of trackedFiles) {
    if (allowedFiles.has(file)) {
      continue;
    }

    const body = await readFile(join(root, file), "utf8");
    for (const phrase of bannedPhrases) {
      if (body.includes(phrase)) {
        violations.push(`${file}: low-signal microcopy "${phrase}"`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("microcopy audit failed:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("microcopy audit passed.");
}

await main().catch((error) => {
  console.error("microcopy audit failed:", error);
  process.exit(1);
});
