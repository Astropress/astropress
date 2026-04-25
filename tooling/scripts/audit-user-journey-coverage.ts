import { join, relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const MANIFEST_PATH = fromRoot("tooling/critical-journeys.json");
const TEST_DIRS = [
	fromRoot("tooling/e2e"),
	fromRoot("packages/astropress/tests"),
];

type JourneyManifest = {
	journeys: Array<{
		id: string;
		marker: string;
		files: string[];
	}>;
};

async function collectTestFiles(): Promise<string[]> {
	const files: string[] = [];
	for (const dir of TEST_DIRS) {
		const entries = await listFiles(dir, {
			recursive: true,
			extensions: [".ts"],
		});
		for (const entry of entries) {
			if (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts")) {
				files.push(join(dir, entry));
			}
		}
	}
	return files.sort();
}

async function main() {
	const report = new AuditReport("user-journey-coverage");
	const manifest = JSON.parse(await readText(MANIFEST_PATH)) as JourneyManifest;
	const testFiles = await collectTestFiles();
	const markerToLocations = new Map<string, string[]>();

	for (const file of testFiles) {
		const source = await readText(file);
		for (const match of source.matchAll(/journey:\s*([a-z0-9-]+)/g)) {
			const marker = match[1];
			const locations = markerToLocations.get(marker) ?? [];
			locations.push(relative(process.cwd(), file));
			markerToLocations.set(marker, locations);
		}
	}

	const declaredMarkers = new Set<string>();
	for (const journey of manifest.journeys) {
		declaredMarkers.add(journey.marker);

		if (!markerToLocations.has(journey.marker)) {
			report.add(
				`${relative(process.cwd(), MANIFEST_PATH)}: journey "${journey.id}" marker ` +
					`"${journey.marker}" is not referenced by any Playwright or Vitest test.`,
			);
		}

		for (const file of journey.files) {
			if (!(await fileExists(fromRoot(file)))) {
				report.add(
					`${relative(process.cwd(), MANIFEST_PATH)}: journey "${journey.id}" references missing file ${file}.`,
				);
			}
		}
	}

	for (const [marker, locations] of markerToLocations) {
		if (!declaredMarkers.has(marker)) {
			report.add(
				`Undeclared journey marker "${marker}" found in ${locations.join(", ")}. ` +
					`Add it to tooling/critical-journeys.json or remove the stale marker.`,
			);
		}
	}

	report.finish(
		`user-journey-coverage audit passed — ${manifest.journeys.length} critical journey(s) mapped to executable tests.`,
	);
}

runAudit("user-journey-coverage", main);
