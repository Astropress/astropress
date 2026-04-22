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

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const PAGES_DIR = join(root, "packages/astropress/pages");
const COMPONENTS_DIR = join(root, "packages/astropress/components");

async function walkAstroFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { recursive: true });
		for (const entry of entries) {
			if (entry.endsWith(".astro") || entry.endsWith(".ts")) {
				files.push(join(dir, entry));
			}
		}
	} catch {
		// Directory may not exist (e.g. pre-build)
	}
	return files.sort();
}

const PKG_JSON = join(root, "packages/astropress/package.json");

async function main() {
	const violations: string[] = [];

	const pagesFiles = await walkAstroFiles(PAGES_DIR);
	const componentsFiles = await walkAstroFiles(COMPONENTS_DIR);
	const allFiles = [...pagesFiles, ...componentsFiles];

	for (const filePath of allFiles) {
		const relPath = relative(root, filePath);
		const src = await readFile(filePath, "utf8");

		// Rule 1: no bare `from "astropress/` — must be `@astropress-diy/astropress/`
		// Match: from "astropress/X" or from 'astropress/X'
		const bareImportPattern = /from\s+["']astropress\/[^"']/g;
		for (const m of src.matchAll(bareImportPattern)) {
			const snippet = src
				.slice(m.index ?? 0, (m.index ?? 0) + 60)
				.split("\n")[0];
			violations.push(
				`[bare-import] ${relPath}: bare "astropress/" import — use "@astropress-diy/astropress/" instead\n    → ${snippet}`,
			);
		}
	}

	// Rule 2: package.json exports map — every non-glob TypeScript source entry must exist on disk
	// Glob entries (containing "*") are skipped; they resolve at build time.
	const pkgSrc = await readFile(PKG_JSON, "utf8");
	const pkg = JSON.parse(pkgSrc) as { exports?: Record<string, unknown> };
	const exportsMap = pkg.exports ?? {};
	const pkgDir = join(root, "packages/astropress");

	for (const [exportKey, exportValue] of Object.entries(exportsMap)) {
		if (exportKey.includes("*")) continue; // glob entry — skip

		// Collect all string values from the condition object (or the value itself)
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
			try {
				await readFile(abs);
			} catch {
				violations.push(
					`[missing-export] package.json exports "${exportKey}" → "${p}" does not exist on disk`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error(
			`consumer-packaging audit failed — ${violations.length} issue(s) in ${allFiles.length} files:\n`,
		);
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	console.log(
		`consumer-packaging audit passed — ${allFiles.length} files scanned, no bare imports. Exports map validated.`,
	);
}

main().catch((err) => {
	console.error("consumer-packaging audit failed:", err);
	process.exit(1);
});
