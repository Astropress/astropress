/**
 * Validates that every .ts file in packages/astropress/src/ that has a .js
 * sibling exports the same named symbols in both files.
 *
 * This catches the most common divergence: adding an export to the TypeScript
 * source and forgetting to update the pre-compiled JavaScript counterpart.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve("packages/astropress/src");

function listTsFiles(root: string, files: string[] = []) {
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    if (statSync(fullPath).isDirectory()) {
      listTsFiles(fullPath, files);
    } else if (fullPath.endsWith(".ts") && !fullPath.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractExports(source: string): Set<string> {
  const exports = new Set<string>();

  // export function/class/const/let/var/type/interface/enum Foo
  for (const match of source.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/gm)) {
    exports.add(match[1]);
  }

  // export { Foo, Bar as Baz }
  for (const match of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).at(-1)?.trim();
      if (name && name !== "default") {
        exports.add(name);
      }
    }
  }

  return exports;
}

const tsFiles = listTsFiles(SRC_ROOT);
const problems: string[] = [];

for (const tsFile of tsFiles) {
  const jsFile = tsFile.replace(/\.ts$/, ".js");

  let jsStat: ReturnType<typeof statSync> | null = null;
  try {
    jsStat = statSync(jsFile);
  } catch {
    // No .js sibling — TypeScript-only file, skip
    continue;
  }

  if (!jsStat.isFile()) {
    continue;
  }

  const tsSource = readFileSync(tsFile, "utf8");
  const jsSource = readFileSync(jsFile, "utf8");

  const tsExports = extractExports(tsSource);
  const jsExports = extractExports(jsSource);

  const relPath = path.relative(process.cwd(), tsFile);

  for (const name of tsExports) {
    if (!jsExports.has(name)) {
      problems.push(`${relPath}: export "${name}" is in .ts but missing from .js`);
    }
  }

  for (const name of jsExports) {
    if (!tsExports.has(name)) {
      problems.push(`${relPath}: export "${name}" is in .js but missing from .ts`);
    }
  }
}

if (problems.length > 0) {
  console.error(".ts/.js export sync check FAILED:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error("\nEdit both files when adding or removing exports.");
  process.exit(1);
}

console.log(`.ts/.js export sync check passed (${tsFiles.length} source files checked).`);
