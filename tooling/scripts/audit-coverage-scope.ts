import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const VITEST_CONFIG_PATH = fromRoot("packages/astropress/vitest.config.ts");
const JOURNEY_MANIFEST_PATH = fromRoot("tooling/critical-journeys.json");
const EXEMPTIONS_PATH = fromRoot("tooling/coverage-scope-exemptions.json");
const ADMIN_PAGES_DIR = fromRoot("packages/astropress/pages/ap-admin");
const E2E_DIR = fromRoot("tooling/e2e");
const TESTS_DIR = fromRoot("packages/astropress/tests");
const CONSUMER_SMOKE_SCRIPT = fromRoot("tooling/scripts/run-consumer-smoke.ts");

type JourneyManifest = {
	journeys: Array<{
		id: string;
		marker: string;
		files: string[];
	}>;
};

type ExemptionManifest = {
	exemptions: Record<string, string>;
};

function astroFileToRoute(relPath: string): string | null {
	if (relPath.includes("[")) return null;
	let route = relPath
		.replace(/\.astro$/, "")
		.replace(/\/index$/, "")
		.replace(/^index$/, "");
	route = route.replace(/\\/g, "/");
	return route ? `/ap-admin/${route}` : "/ap-admin";
}

function extractQuotedEntries(source: string, arrayName: string): string[] {
	const start = source.indexOf(`${arrayName}: [`);
	if (start === -1) return [];
	const slice = source.slice(start, start + 4000);
	return [...slice.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

async function collectPlaywrightRoutes(): Promise<Set<string>> {
	const routes = new Set<string>();
	const entries = await listFiles(E2E_DIR, {
		extensions: [".ts"],
	});
	for (const entry of entries) {
		if (!entry.endsWith(".spec.ts")) continue;
		const source = await readText(join(E2E_DIR, entry));
		for (const match of source.matchAll(/page\.goto\s*\(\s*["'`](\/ap-admin[^"'`?]*)/g)) {
			routes.add(match[1]);
		}
		for (const match of source.matchAll(/path:\s*["'](\/ap-admin[^"'?]*)/g)) {
			routes.add(match[1]);
		}
	}
	return routes;
}

async function collectSmokeRoutes(): Promise<Set<string>> {
	const routes = new Set<string>();
	const source = await readText(CONSUMER_SMOKE_SCRIPT);
	for (const match of source.matchAll(/"(\/ap-admin[^"?]*)(?:\?[^"]*)?"/g)) {
		routes.add(match[1]);
	}
	return routes;
}

async function collectMatchingTestBasenames(): Promise<Set<string>> {
	const basenames = new Set<string>();
	const entries = await listFiles(TESTS_DIR, {
		recursive: true,
		extensions: [".ts"],
	});
	for (const entry of entries) {
		if (!entry.endsWith(".test.ts")) continue;
		const base = entry.split("/").pop()?.replace(/\.test\.ts$/, "");
		if (base) basenames.add(base);
	}
	return basenames;
}

async function main() {
	const report = new AuditReport("coverage-scope");
	const vitestConfig = await readText(VITEST_CONFIG_PATH);
	const coverageIncludes = new Set(extractQuotedEntries(vitestConfig, "include"));
	const journeyManifest = JSON.parse(
		await readText(JOURNEY_MANIFEST_PATH),
	) as JourneyManifest;
	const exemptions = JSON.parse(
		await readText(EXEMPTIONS_PATH),
	) as ExemptionManifest;
	const journeyCoveredFiles = new Set(
		journeyManifest.journeys.flatMap((journey) => journey.files),
	);
	const playwrightRoutes = await collectPlaywrightRoutes();
	const smokeRoutes = await collectSmokeRoutes();
	const matchingTestBasenames = await collectMatchingTestBasenames();

	const candidateFiles = new Set<string>([
		"packages/astropress/components/AdminLayout.astro",
		"packages/astropress/src/admin-action-utils.ts",
		"packages/astropress/src/content-repository-factory.ts",
		"packages/astropress/src/runtime-actions-content.ts",
		"packages/astropress/src/runtime-actions-users.ts",
		"packages/astropress/src/runtime-actions-media.ts",
		"packages/astropress/src/runtime-actions-taxonomies.ts",
		"packages/astropress/src/runtime-actions-misc.ts",
	]);

	const adminAstroFiles = await listFiles(ADMIN_PAGES_DIR, {
		recursive: true,
		extensions: [".astro"],
	});
	for (const entry of adminAstroFiles) {
		candidateFiles.add(`packages/astropress/pages/ap-admin/${entry.replace(/\\/g, "/")}`);
	}

	for (const [file, reason] of Object.entries(exemptions.exemptions)) {
		if (!reason.trim()) {
			report.add(`${EXEMPTIONS_PATH}: exemption for ${file} is missing a reason.`);
		}
		if (!candidateFiles.has(file)) {
			report.add(
				`${EXEMPTIONS_PATH}: exemption for ${file} is stale because the file is not in the audited coverage scope.`,
			);
		}
	}

	for (const file of [...candidateFiles].sort()) {
		if (exemptions.exemptions[file]) continue;
		if (coverageIncludes.has(file.replace("packages/astropress/", ""))) continue;
		if (journeyCoveredFiles.has(file)) continue;

		if (file.endsWith(".astro")) {
			const relPath = file.replace("packages/astropress/pages/ap-admin/", "");
			const route = astroFileToRoute(relPath);
			if (route && (playwrightRoutes.has(route) || smokeRoutes.has(route))) continue;
		}

		const baseName = file.split("/").pop()?.replace(/\.(astro|ts)$/, "") ?? "";
		if (matchingTestBasenames.has(baseName)) continue;

		report.add(
			`${file} is in the user-facing coverage scope but has no Vitest coverage include, ` +
				`matching test basename, critical journey mapping, or reviewed exemption.`,
		);
	}

	report.finish(
		`coverage-scope audit passed — ${candidateFiles.size} scoped user-facing/runtime file(s) accounted for.`,
	);
}

runAudit("coverage-scope", main);
