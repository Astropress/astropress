/**
 * Consumer Packaging Audit
 *
 * Scans all .astro files in packages/astropress/pages/ and packages/astropress/components/
 * for import patterns that would break for real npm consumers:
 *
 *   1. Bare `from "astropress/` imports — must use `@astropress-diy/astropress/` (the
 *      published scoped name). Bare imports break in Vite 7's module runner when the
 *      file is served from node_modules, because resolveId plugins are not invoked for
 *      imports originating inside node_modules. This is the exact class of bug that
 *      caused /ap-admin/services to 500 for npm consumers.
 *
 * Only the bare-import check is enforced; relative imports between sibling directories
 * within the package (e.g. pages/ → src/) are normal and allowed.
 *
 * This audit is intentionally fast (static analysis, no server). It runs in CI as
 * part of test-consumer before the tarball smoke test.
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const PAGES_DIR = fromRoot("packages/astropress/pages");
const COMPONENTS_DIR = fromRoot("packages/astropress/components");
const PKG_JSON = fromRoot("packages/astropress/package.json");

async function collectSources(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, { recursive: true });
	return entries
		.filter((e) => e.endsWith(".astro") || e.endsWith(".ts"))
		.map((e) => join(dir, e))
		.sort();
}

async function main() {
	const report = new AuditReport("consumer-packaging");

	const pagesFiles = await collectSources(PAGES_DIR);
	const componentsFiles = await collectSources(COMPONENTS_DIR);
	const allFiles = [...pagesFiles, ...componentsFiles];

	for (const filePath of allFiles) {
		const relPath = relative(ROOT, filePath);
		const src = await readText(filePath);

		// Rule 1: no bare `from "astropress/` — must be `@astropress-diy/astropress/`
		const bareImportPattern = /from\s+["']astropress\/[^"']/g;
		for (const m of src.matchAll(bareImportPattern)) {
			const snippet = src
				.slice(m.index ?? 0, (m.index ?? 0) + 60)
				.split("\n")[0];
			report.add(
				`[bare-import] ${relPath}: bare "astropress/" import — use "@astropress-diy/astropress/" instead\n    → ${snippet}`,
			);
		}
	}

	// Rule 2: package.json exports map — every non-glob TypeScript source entry must exist on disk
	const pkgSrc = await readText(PKG_JSON);
	const pkg = JSON.parse(pkgSrc) as { exports?: Record<string, unknown> };
	const exportsMap = pkg.exports ?? {};
	const pkgDir = fromRoot("packages/astropress");

	for (const [exportKey, exportValue] of Object.entries(exportsMap)) {
		if (exportKey.includes("*")) continue; // glob entry — skip

		const paths: string[] = [];
		if (typeof exportValue === "string") {
			paths.push(exportValue);
		} else if (exportValue && typeof exportValue === "object") {
			for (const v of Object.values(exportValue as Record<string, unknown>)) {
				if (typeof v === "string") paths.push(v);
			}
		}

		for (const p of paths) {
			if (p.includes("*")) continue; // glob value — skip
			const abs = join(pkgDir, p);
			if (!(await fileExists(abs))) {
				report.add(
					`[missing-export] package.json exports "${exportKey}" → "${p}" does not exist on disk`,
				);
			}
		}
	}

	report.finish(
		`consumer-packaging audit passed — ${allFiles.length} files scanned, no bare imports. Exports map validated.`,
	);
}

runAudit("consumer-packaging", main);
