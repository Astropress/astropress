/**
 * CSP Inline Styles Audit
 *
 * Scans source files for hardcoded `allowInlineStyles: true` — a value that
 * relaxes the Content-Security-Policy in production builds. The correct pattern
 * is `allowInlineStyles: import.meta.env.DEV`, which is true only in dev mode
 * (where Vite injects inline <style> blocks) and false in production builds.
 *
 * Hardcoding `true` was the root cause of:
 *   - AdminLayout.astro passing allowInlineStyles: true unconditionally, which
 *     relaxed production CSP for all admin pages.
 *
 * Hardcoding `false` (or omitting it) in the middleware entrypoint was the root
 * cause of the login page rendering without CSS in dev mode.
 *
 * This audit enforces that every allowInlineStyles value in the astropress
 * package source is keyed to import.meta.env.DEV, never a literal boolean.
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

// Directories to scan
const SCAN_DIRS = [
	fromRoot("packages/astropress/src"),
	fromRoot("packages/astropress/components"),
	fromRoot("packages/astropress/pages"),
];

const EXTENSIONS = [".ts", ".astro", ".mjs", ".js"] as const;

async function walkFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, {
		recursive: true,
		extensions: EXTENSIONS,
	});
	return entries.map((e) => join(dir, e)).sort();
}

async function main() {
	const report = new AuditReport("csp-inline-styles");
	const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkFiles(d)));
	const files = allDirs.flat();

	for (const filePath of files) {
		const relPath = relative(ROOT, filePath);
		const src = await readText(filePath);
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/allowInlineStyles\s*:\s*true\b/.test(line)) {
				report.add(
					`[hardcoded-true] ${relPath}:${i + 1}: allowInlineStyles: true — use import.meta.env.DEV instead\n    → ${line.trim()}`,
				);
			}
			if (/allowInlineStyles\s*:\s*false\b/.test(line)) {
				report.add(
					`[hardcoded-false] ${relPath}:${i + 1}: allowInlineStyles: false — use import.meta.env.DEV instead\n    → ${line.trim()}`,
				);
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nFix: replace allowInlineStyles: true/false with allowInlineStyles: import.meta.env.DEV",
		);
	}

	report.finish(
		`csp-inline-styles audit passed — ${files.length} files scanned, no hardcoded allowInlineStyles values.`,
	);
}

runAudit("csp-inline-styles", main);
