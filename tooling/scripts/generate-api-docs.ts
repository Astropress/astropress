#!/usr/bin/env bun
/**
 * generate-api-docs.ts
 *
 * Generates docs/reference/API_REFERENCE.md from the TypeScript compiler API.
 * Uses ts.createProgram + TypeChecker to extract full signatures (parameter
 * types, return types) and JSDoc from every exported symbol in the key
 * entry-point files.
 *
 * Usage:
 *   bun run tooling/scripts/generate-api-docs.ts          # generate
 *   bun run tooling/scripts/generate-api-docs.ts --check  # fail if output is stale
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dir, "..", "..");
const PKG_DIR = join(ROOT, "packages/astropress");
const OUT_FILE = join(ROOT, "docs/reference/API_REFERENCE.md");
const CHECK_MODE = process.argv.includes("--check");

// ── Entry points to document ────────────────────────────────────────────────

const ENTRY_POINTS: Array<[filePath: string, label: string]> = [
  [join(PKG_DIR, "index.ts"), "astropress"],
  [join(PKG_DIR, "src/config.ts"), "astropress (config)"],
  [join(PKG_DIR, "src/platform-contracts.ts"), "astropress/platform-contracts"],
  [join(PKG_DIR, "src/api-middleware.ts"), "astropress/api-middleware"],
  [join(PKG_DIR, "src/admin-ui.ts"), "astropress/admin-ui"],
  [join(PKG_DIR, "src/d1-migrate-ops.ts"), "astropress/d1-migrate-ops"],
  [join(PKG_DIR, "src/db-migrate-ops.ts"), "astropress/db-migrate-ops"],
  [join(PKG_DIR, "src/sqlite-bootstrap.ts"), "astropress/sqlite-bootstrap"],
  [join(PKG_DIR, "src/cache-purge.ts"), "astropress (cache-purge)"],
  [join(PKG_DIR, "src/transactional-email.ts"), "astropress/transactional-email"],
  [join(PKG_DIR, "src/analytics.ts"), "astropress/analytics"],
  [join(PKG_DIR, "src/public-site-integration.ts"), "astropress/integration"],
];

// ── TypeScript program ───────────────────────────────────────────────────────

const tsconfigPath = join(PKG_DIR, "tsconfig.json");
const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, PKG_DIR);

const program = ts.createProgram({
  rootNames: ENTRY_POINTS.map(([f]) => f).filter(existsSync),
  options: {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  },
});

const checker = program.getTypeChecker();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getJsDoc(symbol: ts.Symbol): string {
  const parts = symbol.getDocumentationComment(checker);
  return ts.displayPartsToString(parts).replace(/\n+/g, " ").trim();
}

function formatTypeStr(type: ts.Type, node?: ts.Node): string {
  return checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);
}

function getSymbolKind(symbol: ts.Symbol): "function" | "type" | "interface" | "const" | "class" | "enum" {
  const flags = symbol.flags;
  if (flags & ts.SymbolFlags.Function) return "function";
  if (flags & ts.SymbolFlags.Class) return "class";
  if (flags & ts.SymbolFlags.Interface) return "interface";
  if (flags & ts.SymbolFlags.TypeAlias) return "type";
  if (flags & ts.SymbolFlags.Enum) return "enum";
  // Could be an alias wrapping a function (export { foo } from '...')
  const aliased = symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
  if (aliased.flags & ts.SymbolFlags.Function) return "function";
  if (aliased.flags & ts.SymbolFlags.Interface) return "interface";
  if (aliased.flags & ts.SymbolFlags.TypeAlias) return "type";
  if (aliased.flags & ts.SymbolFlags.Class) return "class";
  return "const";
}

function getFunctionSignature(symbol: ts.Symbol, name: string): string {
  const type = checker.getTypeOfSymbol(symbol);
  const sigs = checker.getSignaturesOfType(type, ts.SignatureKind.Call);

  if (sigs.length === 0) {
    // Try looking at aliased symbol
    if (symbol.flags & ts.SymbolFlags.Alias) {
      const aliased = checker.getAliasedSymbol(symbol);
      const aliasType = checker.getTypeOfSymbol(aliased);
      const aliasSigs = checker.getSignaturesOfType(aliasType, ts.SignatureKind.Call);
      if (aliasSigs.length > 0) {
        return formatSignatures(name, aliasSigs);
      }
    }
    return `function ${name}(...)`;
  }

  return formatSignatures(name, sigs);
}

function formatSignatures(name: string, sigs: readonly ts.Signature[]): string {
  return sigs
    .map((sig) => {
      const typeParams = sig.typeParameters
        ? `<${sig.typeParameters.map((tp) => tp.symbol.name).join(", ")}>`
        : "";
      const params = sig.parameters.map((p) => {
        const paramType = checker.getTypeOfSymbol(p);
        const isOptional = p.flags & ts.SymbolFlags.Optional ? "?" : "";
        return `${p.name}${isOptional}: ${formatTypeStr(paramType)}`;
      });
      const returnType = formatTypeStr(sig.getReturnType());
      return `function ${name}${typeParams}(${params.join(", ")}): ${returnType}`;
    })
    .join("\n");
}

// ── Collect entries ──────────────────────────────────────────────────────────

interface ApiEntry {
  name: string;
  kind: "function" | "type" | "interface" | "const" | "class" | "enum";
  signature?: string;
  description?: string;
  source: string;
}

const allEntries: ApiEntry[] = [];
const seenNames = new Set<string>();

for (const [filePath, label] of ENTRY_POINTS) {
  if (!existsSync(filePath)) continue;

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) continue;

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) continue;

  const exports = checker.getExportsOfModule(moduleSymbol);

  for (const sym of exports) {
    const name = sym.getName();
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const kind = getSymbolKind(sym);
    const description = getJsDoc(sym);

    let signature: string | undefined;
    if (kind === "function") {
      signature = getFunctionSignature(sym, name);
    } else if (kind === "const") {
      // For const, show the type
      const type = checker.getTypeOfSymbol(sym);
      const typeStr = formatTypeStr(type);
      if (typeStr !== "any" && typeStr.length < 200) {
        signature = `const ${name}: ${typeStr}`;
      }
    }

    allEntries.push({ name, kind, signature, description, source: label });
  }
}

// ── Build output ─────────────────────────────────────────────────────────────

const bySource = new Map<string, ApiEntry[]>();
for (const entry of allEntries) {
  const group = bySource.get(entry.source) ?? [];
  group.push(entry);
  bySource.set(entry.source, group);
}

// Preserve ENTRY_POINTS order for sections
const orderedSources = ENTRY_POINTS.map(([, label]) => label);

const lines: string[] = [
  "# Astropress API Reference",
  "",
  "Auto-generated from TypeScript source via the TypeScript compiler API.",
  "Run `bun run docs:api` to regenerate.",
  "",
  `Generated: ${new Date().toISOString().split("T")[0]}`,
  "",
  "---",
  "",
];

for (const source of orderedSources) {
  const entries = bySource.get(source);
  if (!entries || entries.length === 0) continue;

  lines.push(`## \`${source}\``);
  lines.push("");

  const functions = entries.filter((e) => e.kind === "function");
  const types = entries.filter((e) => e.kind === "interface" || e.kind === "type" || e.kind === "enum");
  const consts = entries.filter((e) => e.kind === "const" || e.kind === "class");

  if (functions.length > 0) {
    lines.push("### Functions");
    lines.push("");
    for (const fn of functions) {
      lines.push(`#### \`${fn.name}\``);
      if (fn.signature) lines.push("```ts", fn.signature, "```");
      if (fn.description) lines.push("", fn.description);
      lines.push("");
    }
  }

  if (types.length > 0) {
    lines.push("### Types & Interfaces");
    lines.push("");
    for (const t of types) {
      const prefix = t.kind === "interface" ? "interface" : t.kind === "enum" ? "enum" : "type";
      lines.push(`- \`${prefix} ${t.name}\`${t.description ? " — " + t.description : ""}`);
    }
    lines.push("");
  }

  if (consts.length > 0) {
    lines.push("### Constants & Re-exports");
    lines.push("");
    for (const c of consts) {
      if (c.signature) {
        lines.push(`- \`${c.signature}\`${c.description ? " — " + c.description : ""}`);
      } else {
        lines.push(`- \`${c.name}\`${c.description ? " — " + c.description : ""}`);
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
}

const output = lines.join("\n");

if (CHECK_MODE) {
  if (!existsSync(OUT_FILE)) {
    console.error("docs:api:check failed — docs/reference/API_REFERENCE.md does not exist. Run `bun run docs:api`.");
    process.exit(1);
  }
  const existing = readFileSync(OUT_FILE, "utf8");
  // Strip the Generated date line before comparing so date changes don't fail the check
  const normalize = (s: string) => s.replace(/^Generated: .+$/m, "Generated: <date>").trim();
  if (normalize(existing) !== normalize(output)) {
    console.error("docs:api:check failed — docs/reference/API_REFERENCE.md is stale. Run `bun run docs:api`.");
    process.exit(1);
  }
  console.log("✓ docs/reference/API_REFERENCE.md is up to date.");
} else {
  writeFileSync(OUT_FILE, output);
  console.log(`✓ API reference written to docs/reference/API_REFERENCE.md (${allEntries.length} entries)`);
}
