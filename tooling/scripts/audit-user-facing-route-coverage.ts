/**
 * User-Facing Route Coverage Audit — Rubric 59 (User-Facing Route Coverage)
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const MAX_UNCOVERED_FRACTION = 0;

interface RouteSurface {
	name: string;
	pagesDir: string;
	routePrefix: string;
	excludedRoutes: Set<string>;
}

const SURFACES: RouteSurface[] = [
	{
		name: "admin",
		pagesDir: fromRoot("packages/astropress/pages/ap-admin"),
		routePrefix: "/ap-admin",
		excludedRoutes: new Set([
			"/ap-admin/404",
			"/ap-admin/subscribers",
			"/ap-admin/import",
			"/ap-admin/fundraising",
		]),
	},
	{
		name: "public (github-pages example)",
		pagesDir: fromRoot("examples/github-pages/src/pages"),
		routePrefix: "",
		excludedRoutes: new Set<string>(),
	},
];

const E2E_DIR = fromRoot("tooling/e2e");
const SMOKE_SCRIPT = fromRoot("tooling/scripts/run-consumer-smoke.ts");

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
	const entries = await listFiles(dir, {
		recursive: true,
		extensions: [".astro"],
	});
	return entries.map((e) => relative(dir, join(dir, e))).sort();
}

async function collectPlaywrightRoutes(): Promise<Set<string>> {
	const routes = new Set<string>();
	const entries = await listFiles(E2E_DIR);
	const specFiles = entries
		.filter((f) => f.endsWith(".spec.ts"))
		.map((f) => join(E2E_DIR, f));

	for (const specFile of specFiles) {
		const src = await readText(specFile);
		const gotoPattern = /page\.goto\s*\(\s*["'`](\/[^"'`?]*)/g;
		for (const m of src.matchAll(gotoPattern)) {
			routes.add(m[1]);
		}
		const pathPattern = /path:\s*["'](\/[^"'?]*)/g;
		for (const m of src.matchAll(pathPattern)) {
			routes.add(m[1]);
		}
	}
	return routes;
}

async function collectSmokeRoutes(): Promise<Set<string>> {
	const routes = new Set<string>();
	const src = await readText(SMOKE_SCRIPT);
	if (src) {
		const routePattern = /"(\/[^"?]*)(?:\?[^"]*)?"/g;
		for (const m of src.matchAll(routePattern)) {
			routes.add(m[1]);
		}
	}
	return routes;
}

async function main() {
	const report = new AuditReport("user-facing-route-coverage");
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

	// ── Report (informational output preserved) ──
	console.log("user-facing-route-coverage audit\n");

	for (const result of surfaceResults) {
		const covered = result.total - result.uncovered.length;
		console.log(`  ${result.name}: ${covered}/${result.total} routes covered`);
		if (result.uncovered.length > 0) {
			for (const r of result.uncovered) console.warn(`    ✗ ${r}`);
		}
	}

	console.log(
		`\n  Coverage sources: ${playwrightRoutes.size} Playwright route(s), ${smokeRoutes.size} smoke route(s)`,
	);

	// ── Per-surface threshold check ──
	for (const result of surfaceResults) {
		const fraction = result.uncovered.length / result.total;
		if (fraction > MAX_UNCOVERED_FRACTION) {
			report.add(
				`${result.name} surface — ${result.uncovered.length}/${result.total} routes ` +
					`(${Math.round(fraction * 100)}%) have no test coverage. Maximum allowed: ${Math.round(MAX_UNCOVERED_FRACTION * 100)}%.`,
			);
		}
	}

	// ── Global threshold check ──
	if (totalChecked > 0) {
		const globalFraction = totalUncovered / totalChecked;
		if (globalFraction > MAX_UNCOVERED_FRACTION) {
			report.add(
				`Global — ${totalUncovered}/${totalChecked} routes ` +
					`(${Math.round(globalFraction * 100)}%) uncovered across all surfaces.`,
			);
		}
	}

	if (report.failed) {
		console.error(
			"\nFix: add uncovered routes to a Playwright spec (page.goto) or to ADMIN_SMOKE_ROUTES.",
		);
	}

	report.finish(
		`\nuser-facing-route-coverage audit passed — ${totalChecked - totalUncovered}/${totalChecked} routes covered across ${surfaceResults.length} surface(s).`,
	);
}

runAudit("user-facing-route-coverage", main);
