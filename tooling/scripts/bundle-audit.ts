/**
 * Bundle tree-shaking audit.
 *
 * After a static site build (e.g. examples/github-pages), scans the output JS
 * bundles for strings that indicate provider-specific adapters leaked into the
 * bundle — a sign that tree-shaking or subpath import isolation broke.
 *
 * Exit codes:
 *   0 — no leakage detected
 *   1 — one or more provider-specific identifiers found in the output
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Strings that must never appear in a non-Cloudflare, non-Supabase build.
// These are internal identifiers from provider-specific adapters.
const CLOUDFLARE_LEAKAGE_PATTERNS = [
  "D1Database",
  "R2Bucket",
  "KVNamespace",
  "getCloudflareBindings",
  "createD1Admin",
];

const SUPABASE_LEAKAGE_PATTERNS = [
  "createClient",
  "@supabase/supabase-js",
  "SupabaseClient",
];

const ALL_LEAKAGE_PATTERNS = [
  ...CLOUDFLARE_LEAKAGE_PATTERNS.map((p) => ({ pattern: p, provider: "Cloudflare" })),
  ...SUPABASE_LEAKAGE_PATTERNS.map((p) => ({ pattern: p, provider: "Supabase" })),
];

function findJsFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findJsFiles(fullPath, files);
    } else if (fullPath.endsWith(".js") || fullPath.endsWith(".mjs")) {
      files.push(fullPath);
    }
  }
  return files;
}

// Default to github-pages example dist; allow override via CLI arg.
const distDir = process.argv[2] ?? "examples/github-pages/dist";

if (!existsSync(distDir)) {
  console.error(`[bundle-audit] Output directory not found: ${distDir}`);
  console.error("  Build the example first: bun run --filter astropress-example-gh-pages build");
  process.exit(1);
}

const jsFiles = findJsFiles(distDir);
if (jsFiles.length === 0) {
  console.log(`[bundle-audit] No JS files found in ${distDir} — skipping.`);
  process.exit(0);
}

const violations: Array<{ file: string; provider: string; pattern: string }> = [];

for (const file of jsFiles) {
  const content = readFileSync(file, "utf8");
  for (const { pattern, provider } of ALL_LEAKAGE_PATTERNS) {
    if (content.includes(pattern)) {
      violations.push({ file: path.relative(process.cwd(), file), provider, pattern });
    }
  }
}

if (violations.length > 0) {
  console.error("[bundle-audit] FAIL — provider-specific code leaked into the static build:");
  for (const v of violations) {
    console.error(`  ${v.file}: found "${v.pattern}" (${v.provider} adapter)`);
  }
  console.error("\nThis means tree-shaking or subpath import isolation is broken.");
  console.error("Check that the static build uses only astropress/adapters/sqlite or a build-time adapter.");
  process.exit(1);
}

console.log(
  `[bundle-audit] OK — ${jsFiles.length} JS file(s) in ${distDir} contain no provider-specific leakage.`,
);
