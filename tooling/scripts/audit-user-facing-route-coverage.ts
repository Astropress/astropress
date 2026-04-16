/**
 * User-Facing Route Coverage Audit — Rubric 59 (User-Facing Route Coverage)
 *
 * Verifies that every static route that renders HTML to a user has at least one
 * automated test reference. This generalizes audit-admin-route-coverage.ts beyond
 * /ap-admin/ to cover ALL user-facing surfaces:
 *
 *   1. Admin routes (packages/astropress/pages/ap-admin/*.astro)
 *   2. Public routes in examples/github-pages (the reference example site)
 *
 * For each surface, the audit checks whether the route appears in:
 *   - A page.goto() call in any Playwright spec (tooling/e2e/*.spec.ts)
 *   - An entry in ADMIN_SMOKE_ROUTES (tooling/scripts/run-consumer-smoke.ts)
 *   - An entry in the static-site accessibility audit (tooling/e2e/example-accessibility.spec.ts)
 *
 * Fails if any checkable route in any surface has zero coverage.
 *
 * Why this matters: the PR 26 bugs (CSP blocking styles, broken imports, duplicate
 * titles) affected 73% of admin routes and were invisible because no test visited
 * those pages. This audit prevents coverage from silently decaying.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const MAX_UNCOVERED_FRACTION = 0;

// ── Route surfaces to audit ──

interface RouteSurface {
  name: string;
  pagesDir: string;
  routePrefix: string;
  excludedRoutes: Set<string>;
}

const SURFACES: RouteSurface[] = [
  {
    name: "admin",
    pagesDir: join(root, "packages/astropress/pages/ap-admin"),
    routePrefix: "/ap-admin",
    excludedRoutes: new Set(["/ap-admin/404"]),
  },
  {
    name: "public (github-pages example)",
    pagesDir: join(root, "examples/github-pages/src/pages"),
    routePrefix: "",
    excludedRoutes: new Set<string>(),
  },
];

// ── Coverage sources ──

const E2E_DIR = join(root, "tooling/e2e");
const SMOKE_SCRIPT = join(root, "tooling/scripts/run-consumer-smoke.ts");

// ── Helpers ──

function astroFileToRoute(relPath: string, prefix: string): string | null {
  if (relPath.includes("[")) return null;
  let route = relPath
    .replace(/\.astro$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");
  route = route.replace(/\\/g, "/");
  return route ? `${prefix}/${route}` : prefix || "/";
}

async function walkAstroFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".astro")) {
        // Return relative path from dir
        const fullPath = join(entry.parentPath, entry.name);
        files.push(relative(dir, fullPath));
      }
    }
  } catch { /* dir not found */ }
  return files.sort();
}

async function collectPlaywrightRoutes(): Promise<Set<string>> {
  const routes = new Set<string>();
  let specFiles: string[] = [];
  try {
    const entries = await readdir(E2E_DIR);
    specFiles = entries.filter((f) => f.endsWith(".spec.ts")).map((f) => join(E2E_DIR, f));
  } catch { /* no e2e dir */ }

  for (const specFile of specFiles) {
    const src = await readFile(specFile, "utf8");
    // Match page.goto("/path") or page.goto(`/path`) — any route prefix
    const gotoPattern = /page\.goto\s*\(\s*["'`](\/[^"'`?]*)/g;
    for (const m of src.matchAll(gotoPattern)) {
      routes.add(m[1]);
    }
    // Also match route objects: { path: "/route" }
    const pathPattern = /path:\s*["'](\/[^"'?]*)/g;
    for (const m of src.matchAll(pathPattern)) {
      routes.add(m[1]);
    }
  }
  return routes;
}

async function collectSmokeRoutes(): Promise<Set<string>> {
  const routes = new Set<string>();
  try {
    const src = await readFile(SMOKE_SCRIPT, "utf8");
    const routePattern = /"(\/[^"?]*)(?:\?[^"]*)?"/g;
    for (const m of src.matchAll(routePattern)) {
      routes.add(m[1]);
    }
  } catch { /* file not found */ }
  return routes;
}

async function main() {
  const playwrightRoutes = await collectPlaywrightRoutes();
  const smokeRoutes = await collectSmokeRoutes();
  const allCoveredRoutes = new Set([...playwrightRoutes, ...smokeRoutes]);

  let totalChecked = 0;
  let totalUncovered = 0;
  const surfaceResults: Array<{
    name: string;
    total: number;
    uncovered: string[];
  }> = [];

  for (const surface of SURFACES) {
    const astroFiles = await walkAstroFiles(surface.pagesDir);
    const staticRoutes: string[] = [];
    for (const f of astroFiles) {
      const route = astroFileToRoute(f, surface.routePrefix);
      if (route) staticRoutes.push(route);
    }

    const filtered = staticRoutes.filter((r) => !surface.excludedRoutes.has(r));
    if (filtered.length === 0) continue;

    const uncovered = filtered.filter((r) => !allCoveredRoutes.has(r));

    surfaceResults.push({
      name: surface.name,
      total: filtered.length,
      uncovered,
    });

    totalChecked += filtered.length;
    totalUncovered += uncovered.length;
  }

  // ── Report ──

  console.log("user-facing-route-coverage audit\n");

  for (const result of surfaceResults) {
    const covered = result.total - result.uncovered.length;
    console.log(`  ${result.name}: ${covered}/${result.total} routes covered`);
    if (result.uncovered.length > 0) {
      for (const r of result.uncovered) console.warn(`    ✗ ${r}`);
    }
  }

  console.log(`\n  Coverage sources: ${playwrightRoutes.size} Playwright route(s), ${smokeRoutes.size} smoke route(s)`);

  // ── Per-surface threshold check ──

  let failed = false;
  for (const result of surfaceResults) {
    const fraction = result.uncovered.length / result.total;
    if (fraction > MAX_UNCOVERED_FRACTION) {
      console.error(
        `\n${result.name} surface FAILED — ${result.uncovered.length}/${result.total} routes ` +
        `(${Math.round(fraction * 100)}%) have no test coverage. Maximum allowed: ${Math.round(MAX_UNCOVERED_FRACTION * 100)}%.`,
      );
      failed = true;
    }
  }

  // ── Global threshold check ──

  if (totalChecked > 0) {
    const globalFraction = totalUncovered / totalChecked;
    if (globalFraction > MAX_UNCOVERED_FRACTION) {
      console.error(
        `\nGlobal FAILED — ${totalUncovered}/${totalChecked} routes ` +
        `(${Math.round(globalFraction * 100)}%) uncovered across all surfaces.`,
      );
      failed = true;
    }
  }

  if (failed) {
    console.error(
      "\nFix: add uncovered routes to a Playwright spec (page.goto) or to ADMIN_SMOKE_ROUTES.",
    );
    process.exit(1);
  }

  console.log(
    `\nuser-facing-route-coverage audit passed — ${totalChecked - totalUncovered}/${totalChecked} routes covered across ${surfaceResults.length} surface(s).`,
  );
}

main().catch((err) => {
  console.error("user-facing-route-coverage audit failed:", err);
  process.exit(1);
});
