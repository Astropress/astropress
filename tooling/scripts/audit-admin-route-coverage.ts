/**
 * Admin Route Coverage Audit
 *
 * Verifies that every static admin route in packages/astropress/pages/ap-admin/ is
 * covered by at least one of:
 *   - A page.goto() call in tooling/e2e/*.spec.ts (Playwright browser coverage), OR
 *   - An entry in ADMIN_SMOKE_ROUTES in tooling/scripts/run-consumer-smoke.ts (HTTP smoke)
 *
 * Fails if any static admin route has zero coverage in both sources.
 * This prevents the 73% coverage gap that existed before this audit was introduced.
 *
 * Dynamic route files (containing [param] or [...param]) are excluded from mandatory
 * coverage because they require seeded data to produce a valid URL; the smoke route
 * list already covers representative instances.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ADMIN_PAGES_DIR = join(root, "packages/astropress/pages/ap-admin");
const E2E_DIR = join(root, "tooling/e2e");
const SMOKE_SCRIPT = join(root, "tooling/scripts/run-consumer-smoke.ts");

const MAX_UNCOVERED_FRACTION = 0; // fail if any static route is uncovered

// Routes that intentionally return non-200 HTTP statuses (e.g. custom error pages).
// These are excluded from mandatory coverage because a smoke test asserting 200 would
// always fail for them by design.
const EXCLUDED_ROUTES = new Set(["/ap-admin/404"]);

// Convert an .astro file path (relative to ap-admin/) to the URL path it serves.
// e.g. "settings.astro" → "/ap-admin/settings"
//      "posts/index.astro" → "/ap-admin/posts"
//      "posts/[slug].astro" → dynamic, skip
function astroFileToRoute(relPath: string): string | null {
  // Skip dynamic routes (files with [param] segments)
  if (relPath.includes("[")) return null;

  let route = relPath
    .replace(/\.astro$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");

  // Normalize slashes
  route = route.replace(/\\/g, "/");

  // Prepend /ap-admin
  return route ? `/ap-admin/${route}` : "/ap-admin";
}

async function walkAstroFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { recursive: true });
    for (const entry of entries) {
      if (typeof entry === "string" && entry.endsWith(".astro")) {
        files.push(entry);
      }
    }
  } catch {
    // Directory not found
  }
  return files.sort();
}

async function main() {
  // 1. Collect all static admin routes from .astro files
  const astroFiles = await walkAstroFiles(ADMIN_PAGES_DIR);
  const staticRoutes: string[] = [];
  for (const f of astroFiles) {
    const route = astroFileToRoute(f);
    if (route) staticRoutes.push(route);
  }

  // Apply exclusions
  const filteredRoutes = staticRoutes.filter((r) => !EXCLUDED_ROUTES.has(r));

  if (filteredRoutes.length === 0) {
    console.error("admin-route-coverage audit: no .astro files found in pages/ap-admin/ — is the path correct?");
    process.exit(1);
  }

  // 2. Collect routes referenced in Playwright spec files
  const e2eEntries = await readdir(E2E_DIR).catch(() => [] as string[]);
  const specFiles = e2eEntries.filter((f) => f.endsWith(".spec.ts")).map((f) => join(E2E_DIR, f));

  const playwrightRoutes = new Set<string>();
  for (const specFile of specFiles) {
    const src = await readFile(specFile, "utf8");
    // Match page.goto("/ap-admin/...") or page.goto(`/ap-admin/...`)
    const gotoPattern = /page\.goto\s*\(\s*["'`](\/ap-admin[^"'`?]*)/g;
    for (const m of src.matchAll(gotoPattern)) {
      playwrightRoutes.add(m[1]);
    }
  }

  // 3. Collect routes from ADMIN_SMOKE_ROUTES in run-consumer-smoke.ts
  const smokeRoutes = new Set<string>();
  try {
    const smokeSrc = await readFile(SMOKE_SCRIPT, "utf8");
    const routePattern = /"(\/ap-admin[^"?]*)(?:\?[^"]*)?"/g;
    for (const m of smokeSrc.matchAll(routePattern)) {
      smokeRoutes.add(m[1]);
    }
  } catch {
    console.warn("admin-route-coverage: could not read run-consumer-smoke.ts — smoke routes not checked");
  }

  // 4. Find uncovered routes
  const uncovered: string[] = [];
  for (const route of filteredRoutes) {
    const inPlaywright = playwrightRoutes.has(route);
    const inSmoke = smokeRoutes.has(route);
    if (!inPlaywright && !inSmoke) {
      uncovered.push(route);
    }
  }

  const uncoveredFraction = uncovered.length / filteredRoutes.length;
  const relSmokeScript = relative(root, SMOKE_SCRIPT);

  console.log(`admin-route-coverage: ${staticRoutes.length} static routes (${EXCLUDED_ROUTES.size} excluded), ${uncovered.length} uncovered`);
  console.log(`  Playwright coverage: ${playwrightRoutes.size} route reference(s) across ${specFiles.length} spec file(s)`);
  console.log(`  Smoke coverage: ${smokeRoutes.size} route(s) in ${relSmokeScript}`);

  if (uncovered.length > 0) {
    console.warn("\n  Uncovered routes:");
    for (const r of uncovered) console.warn(`    - ${r}`);
  }

  if (uncoveredFraction > MAX_UNCOVERED_FRACTION) {
    console.error(
      `\nadmin-route-coverage audit FAILED — ${uncovered.length}/${staticRoutes.length} static routes ` +
      `(${Math.round(uncoveredFraction * 100)}%) have no Playwright or smoke coverage. ` +
      `Maximum allowed: ${Math.round(MAX_UNCOVERED_FRACTION * 100)}%.`,
    );
    console.error(
      `Add the uncovered routes to ADMIN_SMOKE_ROUTES in ${relSmokeScript} or add page.goto() calls in a Playwright spec.`,
    );
    process.exit(1);
  }

  console.log(
    `\nadmin-route-coverage audit passed — ${filteredRoutes.length - uncovered.length}/${filteredRoutes.length} checkable static routes covered.`,
  );
}

main().catch((err) => {
  console.error("admin-route-coverage audit failed:", err);
  process.exit(1);
});
