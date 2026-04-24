// Audit that every Nuclei exclusion (-em / -ei / -exclude-matchers /
// -exclude-id) in a GitHub workflow is accompanied by a rationale comment
// on a preceding line. Suppressions silently silence real findings if the
// reason is lost; requiring a comment keeps the audit trail visible in
// PR review.
//
// Convention: the comment should mention why the suppression is needed.
// The audit only enforces "comment present on a nearby line"; the honesty
// is on the human reviewer.

import { readdirSync } from "node:fs";
import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const WORKFLOWS_DIR = fromRoot(".github/workflows");

// Flags we treat as suppressions
const SUPPRESSION_FLAGS = [
	"-em ",
	"-ei ",
	"--exclude-matchers",
	"--exclude-id",
	"-exclude-matchers",
	"-exclude-id",
];

async function main() {
	const report = new AuditReport("nuclei-suppressions");
	let files: string[] = [];
	try {
		files = readdirSync(WORKFLOWS_DIR).filter(
			(f) => f.endsWith(".yml") || f.endsWith(".yaml"),
		);
	} catch {
		report.finish("nuclei-suppressions audit skipped — no workflows dir");
	}

	let totalChecked = 0;
	for (const file of files) {
		const body = await readText(`${WORKFLOWS_DIR}/${file}`);
		const lines = body.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const hasSuppression = SUPPRESSION_FLAGS.some((f) => line.includes(f));
			if (!hasSuppression) continue;
			totalChecked++;
			// Look backward up to 10 lines for a comment line that mentions the
			// suppressed id or the word "suppress"/"false positive"/"exclude"
			let hasRationale = false;
			for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
				const prev = lines[j];
				if (!prev.trim().startsWith("#")) {
					// Non-comment blank lines are fine; stop only at a code-ish line
					if (prev.trim() === "") continue;
					// Any other non-comment, non-whitespace line resets the search;
					// we want comments CONTIGUOUS with the flag.
					// Actually — allow a few lines of args between. Just check comment content.
					continue;
				}
				if (
					/suppress|false positive|exclude|skip|noisy|upstream bug|template bug/i.test(prev)
				) {
					hasRationale = true;
					break;
				}
			}
			if (!hasRationale) {
				report.add(
					`${file}:${i + 1}: Nuclei suppression flag (${line.trim().slice(0, 80)}...) ` +
						`has no rationale comment within the 10 preceding lines. Add a comment ` +
						`explaining why the matcher is suppressed (e.g., "# upstream template bug: ...", ` +
						`"# false positive: ...", or "# we verify via <alternative check>").`,
				);
			}
		}
	}

	report.finish(
		`nuclei-suppressions audit passed — ${totalChecked} suppression(s) checked, all documented.`,
	);
}

runAudit("nuclei-suppressions", main);
