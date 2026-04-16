/**
 * Title Composition Audit — Rubric 58 (Composition Boundary Hygiene)
 *
 * Scans all .astro files in packages/astropress/pages/, packages/astropress/components/,
 * and examples/ for title props that are pre-formatted with a brand/site suffix.
 *
 * Layout components like <AdminLayout> and <SiteLayout> append their own suffix
 * via buildAstropressAdminDocumentTitle() or <title>{title} | {siteName}</title>.
 * When a caller passes a pre-formatted string, the suffix appears twice:
 *   "Dashboard | Astropress Admin | Astropress Admin"
 *
 * This generalizes the admin-only audit-admin-page-titles.ts to cover ALL user-facing
 * pages — admin, public, and example sites.
 *
 * Rules enforced:
 *   1. title= props must not contain separator + brand patterns (|, —, -)
 *   2. <title> tags must not contain hardcoded brand suffixes (only layout wrappers
 *      should append site names)
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

// Directories to scan for .astro files
const SCAN_DIRS = [
  join(root, "packages/astropress/pages"),
  join(root, "packages/astropress/components"),
  join(root, "examples"),
];

// Known brand/site suffixes that layout components append automatically.
// Checked case-insensitively. The pattern is: separator + brand name.
const BANNED_TITLE_SUFFIXES = [
  "| Astropress Admin",
  "— Astropress Admin",
  "- Astropress Admin",
  "| AstroPress Admin",
  "| Astropress",
  "— Astropress",
  "- Astropress",
];

// Files that are themselves layout wrappers — they legitimately format titles.
// Matched by filename (not full path) to stay stable across directory moves.
const LAYOUT_FILES = new Set([
  "AdminLayout.astro",
  "SiteLayout.astro",
  "AstropressContentLayout.astro",
]);

async function walkAstroFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".astro")) {
        files.push(join(entry.parentPath, entry.name));
      }
    }
  } catch { /* dir not found */ }
  return files.sort();
}

function isLayoutFile(filePath: string): boolean {
  const filename = filePath.split("/").pop() ?? "";
  return LAYOUT_FILES.has(filename);
}

async function main() {
  const violations: string[] = [];
  const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkAstroFiles(d)));
  const files = allDirs.flat();

  for (const filePath of files) {
    // Layout files are allowed to format titles — they're the composition boundary.
    if (isLayoutFile(filePath)) continue;

    const relPath = relative(root, filePath);
    const src = await readFile(filePath, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Rule 1: title= props must not contain pre-formatted brand suffixes.
      if (line.includes("title=")) {
        for (const suffix of BANNED_TITLE_SUFFIXES) {
          if (line.toLowerCase().includes(suffix.toLowerCase())) {
            violations.push(
              `[pre-formatted-title] ${relPath}:${i + 1}: title prop contains "${suffix}" — ` +
              `the layout component will append the suffix again\n    → ${line.trim()}`,
            );
            break;
          }
        }
      }

      // Rule 2: raw <title> tags in non-layout pages should not hardcode brand suffixes.
      // Layout files (which wrap <title>) are excluded above. Pages that use a layout
      // component should not also have their own <title> with a suffix.
      if (/<title>/.test(line)) {
        for (const suffix of BANNED_TITLE_SUFFIXES) {
          if (line.toLowerCase().includes(suffix.toLowerCase())) {
            violations.push(
              `[hardcoded-title-suffix] ${relPath}:${i + 1}: <title> tag contains "${suffix}" — ` +
              `use a layout component or pass a bare title instead\n    → ${line.trim()}`,
            );
            break;
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`title-composition audit failed — ${violations.length} issue(s) in ${files.length} files:\n`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nFix: pass just the section name (e.g. title=\"Dashboard\"). " +
      "The layout component handles the full document title with the site/brand suffix.",
    );
    process.exit(1);
  }

  console.log(
    `title-composition audit passed — ${files.length} files scanned, no pre-formatted titles.`,
  );
}

main().catch((err) => {
  console.error("title-composition audit failed:", err);
  process.exit(1);
});
