import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
	AuditReport,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

// Rubric 43 / 49 — UX Writing & Microcopy
//
// Two-part check:
//   1. Negative: banned low-signal phrases must not appear in user-facing code
//   2. Positive: button labels must use verb phrases; non-verb labels flag a violation

const auditableExtensions = new Set([
	".md",
	".mdx",
	".astro",
	".ts",
	".tsx",
	".rs",
]);
const bannedPhrases = [
	"Something went wrong. Please try again.",
	"An error occurred",
	"Failed to subscribe. Please try again.",
	"Network error. Please try again.",
];
const allowedFiles = new Set([
	"tooling/scripts/audit-microcopy.ts",
	"tooling/scripts/audit-ai-drivability.ts",
	"docs/reference/EVALUATION.md",
	"docs/UX_WRITING.md",
	"AGENTS.md",
]);

const NON_VERB_BUTTON_RE = /<button[^>]*>\s*(Submit|OK|Yes|No)\s*<\/button>/gi;

function isAuditableFile(file: string) {
	return [...auditableExtensions].some((ext) => file.endsWith(ext));
}

async function main() {
	const report = new AuditReport("microcopy");
	const trackedFiles = execFileSync("git", ["ls-files"], {
		cwd: ROOT,
		encoding: "utf8",
	})
		.split("\n")
		.map((file) => file.trim())
		.filter((file) => file.length > 0)
		.filter(
			(file) => !file.startsWith("node_modules/") && isAuditableFile(file),
		);

	for (const file of trackedFiles) {
		if (allowedFiles.has(file)) {
			continue;
		}

		const body = await readText(join(ROOT, file));

		for (const phrase of bannedPhrases) {
			if (body.includes(phrase)) {
				report.add(`${file}: low-signal microcopy "${phrase}"`);
			}
		}

		if (
			file.endsWith(".astro") &&
			(file.includes("ap-admin") || file.includes("components/"))
		) {
			for (const m of body.matchAll(NON_VERB_BUTTON_RE)) {
				const label = m[1];
				report.add(
					`${file}: button label "${label}" is not a verb phrase — use action words like "Save", "Delete", "Confirm"`,
				);
			}
		}
	}

	report.finish("microcopy audit passed.");
}

runAudit("microcopy", main);
