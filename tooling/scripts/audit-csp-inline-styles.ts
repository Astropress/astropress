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

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

// Directories to scan
const SCAN_DIRS = [
	join(root, "packages/astropress/src"),
	join(root, "packages/astropress/components"),
	join(root, "packages/astropress/pages"),
];

const EXTENSIONS = new Set([".ts", ".astro", ".mjs", ".js"]);

async function walkFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { recursive: true });
		for (const entry of entries) {
			const ext = entry.slice(entry.lastIndexOf("."));
			if (EXTENSIONS.has(ext)) files.push(join(dir, entry));
		}
	} catch {
		/* dir may not exist */
	}
	return files.sort();
}

async function main() {
	const violations: string[] = [];
	const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkFiles(d)));
	const files = allDirs.flat();

	for (const filePath of files) {
		const relPath = relative(root, filePath);
		const src = await readFile(filePath, "utf8");
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Flag: allowInlineStyles: true (literal boolean — never correct in production)
			if (/allowInlineStyles\s*:\s*true\b/.test(line)) {
				violations.push(
					`[hardcoded-true] ${relPath}:${i + 1}: allowInlineStyles: true — use import.meta.env.DEV instead\n    → ${line.trim()}`,
				);
			}
			// Flag: allowInlineStyles: false (literal boolean — wrong in middleware entrypoint
			// because it breaks dev mode; should be import.meta.env.DEV)
			if (/allowInlineStyles\s*:\s*false\b/.test(line)) {
				violations.push(
					`[hardcoded-false] ${relPath}:${i + 1}: allowInlineStyles: false — use import.meta.env.DEV instead\n    → ${line.trim()}`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error(
			`csp-inline-styles audit failed — ${violations.length} issue(s) in ${files.length} files:\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: replace allowInlineStyles: true/false with allowInlineStyles: import.meta.env.DEV",
		);
		process.exit(1);
	}

	console.log(
		`csp-inline-styles audit passed — ${files.length} files scanned, no hardcoded allowInlineStyles values.`,
	);
}

main().catch((err) => {
	console.error("csp-inline-styles audit failed:", err);
	process.exit(1);
});
