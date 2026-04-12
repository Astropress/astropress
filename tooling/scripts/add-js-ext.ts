#!/usr/bin/env bun
/**
 * Post-process tsc output: add explicit `.js` extensions to relative imports.
 *
 * tsc with `"module": "preserve"` emits extensionless import specifiers
 * ("./foo"), but Node ESM and the Rust CLI's `node --eval` bridge require
 * fully-qualified relative imports (`./foo.js`). This walks the build output
 * and rewrites extensionless relative imports in .js files only.
 *
 * Bare specifiers (e.g. `"astro"`) and imports with known extensions
 * (`.json`, `.css`, `.wasm`, etc.) are left alone.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (full.endsWith(".js")) files.push(full);
  }
  return files;
}

const [, , root] = process.argv;
if (!root) {
  console.error("usage: add-js-ext.ts <directory>");
  process.exit(1);
}
const files = await walk(root);

// Match: import ... from "./path" or "../path" (relative, no extension).
// Bare specifier imports (no ./ prefix) are left alone.
// Imports that already end in .js, .json, .css, etc. are left alone.
const importRe = /(\bfrom\s+|\bimport\s+)(["'])(\.\.?\/[^"']*?)\2/g;

let totalFiles = 0;
let totalRewrites = 0;

for (const file of files) {
  const src = await readFile(file, "utf8");
  let rewrites = 0;
  const next = src.replace(importRe, (full, keyword, quote, spec) => {
    if (/\.(m?js|cjs|json|node|css|wasm|svg|png|jpg|webp)$/.test(spec)) return full;
    rewrites++;
    return `${keyword}${quote}${spec}.js${quote}`;
  });
  if (rewrites > 0) {
    await writeFile(file, next);
    totalFiles++;
    totalRewrites += rewrites;
  }
}

console.log(`Added .js extension to ${totalRewrites} imports across ${totalFiles} files.`);
