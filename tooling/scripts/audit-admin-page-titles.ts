/**
 * Admin Page Titles Audit
 *
 * Scans all .astro files in packages/astropress/pages/ap-admin/ and verifies
 * that the `title` prop passed to <AdminLayout> does NOT already contain the
 * suffix that buildAstropressAdminDocumentTitle() appends ("| Astropress Admin"
 * or "— Astropress Admin").
 *
 * Passing a pre-formatted title string causes the suffix to appear twice in
 * the browser tab: "Dashboard | Astropress Admin | Astropress Admin".
 * This is the exact bug that affected 33 admin pages on this branch.
 *
 * The correct pattern is to pass just the section name:
 *   title="Dashboard"       ✓
 *   title="Posts"           ✓
 *   title={service.label}   ✓ (as long as service.label is not pre-formatted)
 *
 * Incorrect:
 *   title="Dashboard | Astropress Admin"   ✗
 *   title="Posts — Astropress Admin"       ✗
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ADMIN_PAGES_DIR = join(root, "packages/astropress/pages/ap-admin");

// Suffixes that buildAstropressAdminDocumentTitle appends.
// Checked case-insensitively to catch minor variations.
const BANNED_TITLE_SUFFIXES = [
	"| Astropress Admin",
	"— Astropress Admin",
	"- Astropress Admin",
	"| AstroPress Admin",
];

async function walkAstroFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { recursive: true });
		for (const entry of entries) {
			if (typeof entry === "string" && entry.endsWith(".astro")) {
				files.push(join(dir, entry));
			}
		}
	} catch {
		/* dir not found */
	}
	return files.sort();
}

async function main() {
	const violations: string[] = [];
	const files = await walkAstroFiles(ADMIN_PAGES_DIR);

	for (const filePath of files) {
		const relPath = relative(root, filePath);
		const src = await readFile(filePath, "utf8");
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Only check lines that have a title prop assignment
			if (!line.includes("title=")) continue;

			for (const suffix of BANNED_TITLE_SUFFIXES) {
				if (line.toLowerCase().includes(suffix.toLowerCase())) {
					violations.push(
						`[pre-formatted-title] ${relPath}:${i + 1}: title prop already contains "${suffix}" — ` +
							`buildAstropressAdminDocumentTitle() will append it again\n    → ${line.trim()}`,
					);
					break; // one violation per line is enough
				}
			}
		}
	}

	if (violations.length > 0) {
		console.error(
			`admin-page-titles audit failed — ${violations.length} issue(s) in ${files.length} files:\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			'\nFix: pass just the section name to <AdminLayout title="Dashboard"> — ' +
				"buildAstropressAdminDocumentTitle() handles the full document title.",
		);
		process.exit(1);
	}

	console.log(
		`admin-page-titles audit passed — ${files.length} admin pages scanned, no pre-formatted titles.`,
	);
}

main().catch((err) => {
	console.error("admin-page-titles audit failed:", err);
	process.exit(1);
});
