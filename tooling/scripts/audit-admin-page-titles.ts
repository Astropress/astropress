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

import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const ADMIN_PAGES_DIR = fromRoot("packages/astropress/pages/ap-admin");

// Suffixes that buildAstropressAdminDocumentTitle appends.
// Checked case-insensitively to catch minor variations.
const BANNED_TITLE_SUFFIXES = [
	"| Astropress Admin",
	"— Astropress Admin",
	"- Astropress Admin",
	"| AstroPress Admin",
];

async function main() {
	const report = new AuditReport("admin-page-titles");
	const entries = await listFiles(ADMIN_PAGES_DIR, {
		recursive: true,
		extensions: [".astro"],
	});
	const files = entries.map((e) => join(ADMIN_PAGES_DIR, e)).sort();

	for (const filePath of files) {
		const relPath = relative(ROOT, filePath);
		const src = await readText(filePath);
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Only check lines that have a title prop assignment
			if (!line.includes("title=")) continue;

			for (const suffix of BANNED_TITLE_SUFFIXES) {
				if (line.toLowerCase().includes(suffix.toLowerCase())) {
					report.add(
						`[pre-formatted-title] ${relPath}:${i + 1}: title prop already contains "${suffix}" — ` +
							`buildAstropressAdminDocumentTitle() will append it again\n    → ${line.trim()}`,
					);
					break; // one violation per line is enough
				}
			}
		}
	}

	if (report.failed) {
		// Preserve the fix hint from the original by emitting after violations list.
		// AuditReport.finish() handles the error printing + exit.
		console.error(
			'\nFix: pass just the section name to <AdminLayout title="Dashboard"> — ' +
				"buildAstropressAdminDocumentTitle() handles the full document title.",
		);
	}

	report.finish(
		`admin-page-titles audit passed — ${files.length} admin pages scanned, no pre-formatted titles.`,
	);
}

runAudit("admin-page-titles", main);
