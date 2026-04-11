#!/usr/bin/env bun
/**
 * generate-api-docs.ts
 *
 * Walks the public exports of the astropress package (index.ts + key sub-entry
 * points) and generates a structured API reference in docs/API_REFERENCE.md.
 * Extracts type names, function signatures, and JSDoc comments.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const PKG_DIR = join(ROOT, "packages/astropress");
const OUT_FILE = join(ROOT, "docs/API_REFERENCE.md");

interface ApiEntry {
  name: string;
  kind: "function" | "type" | "interface" | "const" | "class";
  signature?: string;
  description?: string;
  source: string;
}

function extractJsDoc(content: string, pos: number): string {
  const before = content.slice(0, pos);
  const jsdocEnd = before.lastIndexOf("*/");
  if (jsdocEnd === -1) return "";
  const jsdocStart = before.lastIndexOf("/**", jsdocEnd);
  if (jsdocStart === -1) return "";
  const raw = before.slice(jsdocStart + 3, jsdocEnd);
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
}

function parseExports(filePath: string, sourceLabel: string): ApiEntry[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const entries: ApiEntry[] = [];

  // Exported functions
  for (const match of content.matchAll(/export(?:\s+async)?\s+function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)/g)) {
    entries.push({
      name: match[1],
      kind: "function",
      signature: `function ${match[1]}${match[2] ?? ""}(${match[3]})`,
      description: extractJsDoc(content, match.index ?? 0),
      source: sourceLabel,
    });
  }

  // Exported interfaces
  for (const match of content.matchAll(/export\s+interface\s+(\w+)/g)) {
    entries.push({
      name: match[1],
      kind: "interface",
      description: extractJsDoc(content, match.index ?? 0),
      source: sourceLabel,
    });
  }

  // Exported type aliases
  for (const match of content.matchAll(/export\s+type\s+(\w+)\s*[<=]/g)) {
    entries.push({
      name: match[1],
      kind: "type",
      description: extractJsDoc(content, match.index ?? 0),
      source: sourceLabel,
    });
  }

  // Exported const functions / constants
  for (const match of content.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
    entries.push({
      name: match[1],
      kind: "const",
      description: extractJsDoc(content, match.index ?? 0),
      source: sourceLabel,
    });
  }

  // Re-exported names from other modules
  for (const match of content.matchAll(/export\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
    const names = match[1].split(",").map((n) => n.trim().replace(/\s+as\s+\w+/, "")).filter(Boolean);
    for (const name of names) {
      if (!entries.some((e) => e.name === name)) {
        entries.push({ name, kind: "const", source: `${sourceLabel} → ${match[2]}` });
      }
    }
  }

  return entries;
}

const filesToScan: Array<[string, string]> = [
  [join(PKG_DIR, "index.ts"), "astropress"],
  [join(PKG_DIR, "src/config.ts"), "astropress (config)"],
  [join(PKG_DIR, "src/platform-contracts.ts"), "astropress (platform-contracts)"],
  [join(PKG_DIR, "src/api-middleware.ts"), "astropress/api-middleware"],
  [join(PKG_DIR, "src/admin-ui.ts"), "astropress (admin-ui)"],
  [join(PKG_DIR, "src/runtime-actions-content.ts"), "astropress (content actions)"],
  [join(PKG_DIR, "src/runtime-actions-media.ts"), "astropress (media actions)"],
  [join(PKG_DIR, "src/cache-purge.ts"), "astropress (cache-purge)"],
  [join(PKG_DIR, "src/sqlite-bootstrap.ts"), "astropress/sqlite-bootstrap"],
  [join(PKG_DIR, "src/public-site-integration.ts"), "astropress/integration"],
];

const allEntries: ApiEntry[] = [];
for (const [filePath, label] of filesToScan) {
  allEntries.push(...parseExports(filePath, label));
}

// Deduplicate by name (keep first occurrence)
const seen = new Set<string>();
const unique = allEntries.filter((e) => {
  if (seen.has(e.name)) return false;
  seen.add(e.name);
  return true;
});

// Group by source
const bySource = new Map<string, ApiEntry[]>();
for (const entry of unique) {
  const group = bySource.get(entry.source) ?? [];
  group.push(entry);
  bySource.set(entry.source, group);
}

const lines: string[] = [
  "# Astropress API Reference",
  "",
  "Auto-generated from TypeScript source. Run `bun run scripts/generate-api-docs.ts` to regenerate.",
  "",
  `Generated: ${new Date().toISOString().split("T")[0]}`,
  "",
  "---",
  "",
];

for (const [source, entries] of bySource) {
  lines.push(`## \`${source}\``);
  lines.push("");

  const functions = entries.filter((e) => e.kind === "function");
  const types = entries.filter((e) => e.kind === "interface" || e.kind === "type");
  const consts = entries.filter((e) => e.kind === "const");

  if (functions.length > 0) {
    lines.push("### Functions");
    lines.push("");
    for (const fn of functions) {
      lines.push(`#### \`${fn.name}\``);
      if (fn.signature) lines.push(`\`\`\`ts\n${fn.signature}\n\`\`\``);
      if (fn.description) lines.push(fn.description);
      lines.push("");
    }
  }

  if (types.length > 0) {
    lines.push("### Types & Interfaces");
    lines.push("");
    for (const t of types) {
      lines.push(`- \`${t.kind === "interface" ? "interface" : "type"} ${t.name}\`${t.description ? " — " + t.description : ""}`);
    }
    lines.push("");
  }

  if (consts.length > 0) {
    lines.push("### Exported constants / re-exports");
    lines.push("");
    for (const c of consts) {
      lines.push(`- \`${c.name}\`${c.description ? " — " + c.description : ""}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
}

writeFileSync(OUT_FILE, lines.join("\n"));
console.log(`✓ API reference written to docs/API_REFERENCE.md (${unique.length} entries)`);
