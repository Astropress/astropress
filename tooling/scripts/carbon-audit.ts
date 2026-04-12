/**
 * Carbon / performance audit for the astropress example site.
 *
 * Measures:
 *   - Total JavaScript payload (bytes) across all .js files in dist/
 *   - External domain references (scripts and stylesheets)
 *   - Total asset file count
 *
 * Exits non-zero if total JS exceeds JS_BUDGET_BYTES (10 KB by default).
 * This enforces the "low operational footprint" claim in SPEC.md.
 *
 * Usage:
 *   bun tooling/scripts/carbon-audit.ts [--dist path/to/dist] [--budget 10240]
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const JS_BUDGET_BYTES = parseInt(process.env.JS_BUDGET ?? "10240", 10); // 10 KB default

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const distIdx = args.indexOf("--dist");
  const budgetIdx = args.indexOf("--budget");
  const domainsOnly = args.includes("--domains-only");
  const distDir = distIdx >= 0 ? args[distIdx + 1] : path.join(process.cwd(), "examples/github-pages/dist");
  const budget = budgetIdx >= 0 ? parseInt(args[budgetIdx + 1], 10) : JS_BUDGET_BYTES;

  const allFiles = await walk(distDir);
  if (allFiles.length === 0) {
    console.error(`[carbon-audit] No files found in ${distDir}. Run 'bun run build' in examples/github-pages first.`);
    process.exit(1);
  }

  // Find external domain references in HTML
  const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
  const externalDomains = new Set<string>();
  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    const matches = [...html.matchAll(/(?:src|href)="(https?:\/\/[^/"]+)/g)];
    for (const match of matches) {
      try {
        externalDomains.add(new URL(match[1]).hostname);
      } catch { /* skip malformed */ }
    }
  }

  console.log("\n=== Carbon Audit ===");
  if (externalDomains.size > 0) {
    console.log(`External domains : ${[...externalDomains].join(", ")}`);
  } else {
    console.log("External domains : none");
  }

  if (domainsOnly) {
    console.log("(byte budget check delegated to size-limit)\n");
    return;
  }

  // Sum JS payloads
  const jsFiles = allFiles.filter((f) => f.endsWith(".js"));
  let totalJsBytes = 0;
  for (const f of jsFiles) {
    const s = await stat(f);
    totalJsBytes += s.size;
  }

  const totalJsKb = (totalJsBytes / 1024).toFixed(2);
  const passed = totalJsBytes <= budget;

  console.log(`Total JS payload : ${totalJsKb} KB (budget: ${(budget / 1024).toFixed(0)} KB)`);
  console.log(`JS files         : ${jsFiles.length}`);
  console.log(`HTML files       : ${htmlFiles.length}`);
  console.log(`Total assets     : ${allFiles.length}`);
  console.log(`Budget check     : ${passed ? "PASS ✓" : "FAIL ✗"}\n`);

  if (!passed) {
    console.error(
      `[carbon-audit] JS payload (${totalJsKb} KB) exceeds ${(budget / 1024).toFixed(0)} KB budget.`,
    );
    process.exit(1);
  }
}

main();
