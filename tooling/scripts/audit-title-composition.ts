/**
 * Title Composition Audit — Rubric 58 (Composition Boundary Hygiene)
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const SCAN_DIRS = [
	fromRoot("packages/astropress/pages"),
	fromRoot("packages/astropress/components"),
	fromRoot("examples"),
];

const BANNED_TITLE_SUFFIXES = [
	"| Astropress Admin",
	"— Astropress Admin",
	"- Astropress Admin",
	"| AstroPress Admin",
	"| Astropress",
	"— Astropress",
	"- Astropress",
];

const LAYOUT_FILES = new Set([
	"AdminLayout.astro",
	"SiteLayout.astro",
	"AstropressContentLayout.astro",
]);

async function walkAstroFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, {
		recursive: true,
		extensions: [".astro"],
	});
	return entries.map((e) => join(dir, e)).sort();
}

function isLayoutFile(filePath: string): boolean {
	const filename = filePath.split("/").pop() ?? "";
	return LAYOUT_FILES.has(filename);
}

async function main() {
	const report = new AuditReport("title-composition");
	const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkAstroFiles(d)));
	const files = allDirs.flat();

	for (const filePath of files) {
		if (isLayoutFile(filePath)) continue;

		const relPath = relative(ROOT, filePath);
		const src = await readText(filePath);
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.includes("title=")) {
				for (const suffix of BANNED_TITLE_SUFFIXES) {
					if (line.toLowerCase().includes(suffix.toLowerCase())) {
						report.add(
							`[pre-formatted-title] ${relPath}:${i + 1}: title prop contains "${suffix}" — ` +
								`the layout component will append the suffix again\n    → ${line.trim()}`,
						);
						break;
					}
				}
			}

			if (/<title>/.test(line)) {
				for (const suffix of BANNED_TITLE_SUFFIXES) {
					if (line.toLowerCase().includes(suffix.toLowerCase())) {
						report.add(
							`[hardcoded-title-suffix] ${relPath}:${i + 1}: <title> tag contains "${suffix}" — ` +
								`use a layout component or pass a bare title instead\n    → ${line.trim()}`,
						);
						break;
					}
				}
			}
		}
	}

	if (report.failed) {
		console.error(
			'\nFix: pass just the section name (e.g. title="Dashboard"). ' +
				"The layout component handles the full document title with the site/brand suffix.",
		);
	}

	report.finish(
		`title-composition audit passed — ${files.length} files scanned, no pre-formatted titles.`,
	);
}

runAudit("title-composition", main);
