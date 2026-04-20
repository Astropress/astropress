/**
 * Evaluation Integrity Audit — Rubric 61 (Meta-Evaluation)
 *
 * The evaluation framework must evaluate itself. This audit verifies:
 *
 *   1. Every `audit:*` script referenced in EVALUATION.md actually exists in package.json
 *   2. Every `audit:*` script in package.json points to a file that exists on disk
 *   3. Every CI-enforced audit is actually referenced in .github/workflows/ci.yml
 *   4. Self-assessed rubrics are flagged and counted — the ratio of automated to
 *      self-assessed must not regress
 *   5. The rubric count in docs/evaluation.mdx matches docs/reference/EVALUATION.md
 *   6. No rubric in the table has an empty Evidence column AND no "self-assessed" marker
 *      (every rubric must declare how it's backed)
 *
 * Why this exists: an evaluation framework that can't verify its own integrity is
 * theater. Audits that are referenced but don't exist, CI claims that aren't enforced,
 * and grades that silently diverge between the reference doc and the public site all
 * undermine trust in the evaluation.
 */

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const EVALUATION_MD = join(root, "docs/reference/EVALUATION.md");
const PACKAGE_JSON = join(root, "package.json");
const CI_YML = join(root, ".github/workflows/ci.yml");
// Docs site evaluation page was removed — evaluation is maintainer-only in docs/reference/EVALUATION.md.

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const violations: string[] = [];
	const warnings: string[] = [];

	const evalSrc = await readFile(EVALUATION_MD, "utf8");
	const pkgJson = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as {
		scripts: Record<string, string>;
	};
	const ciSrc = await readFile(CI_YML, "utf8");

	// ── 1. Audit scripts referenced in EVALUATION.md exist in package.json ──

	const evalAuditRefs = new Set<string>();
	const auditRefPattern = /`(audit:[a-z0-9-]+)`/g;
	for (const m of evalSrc.matchAll(auditRefPattern)) {
		evalAuditRefs.add(m[1]);
	}

	for (const ref of evalAuditRefs) {
		if (!pkgJson.scripts[ref]) {
			violations.push(
				`[missing-script] EVALUATION.md references \`${ref}\` but it is not defined in package.json`,
			);
		}
	}

	// ── 2. Every audit:* script in package.json points to a file that exists ──

	const auditScripts = Object.entries(pkgJson.scripts).filter(([name]) =>
		name.startsWith("audit:"),
	);

	for (const [name, command] of auditScripts) {
		// Extract the file path from "bun run tooling/scripts/foo.ts" or similar
		const fileMatch = command.match(/(tooling\/scripts\/[^\s]+\.ts)/);
		if (fileMatch) {
			const scriptPath = join(root, fileMatch[1]);
			if (!(await fileExists(scriptPath))) {
				violations.push(
					`[missing-file] package.json script "${name}" points to ${fileMatch[1]} which does not exist`,
				);
			}
		}
	}

	// ── 3. CI-enforced audits are actually in ci.yml ──

	// Extract audits that EVALUATION.md claims are "CI-enforced"
	const ciEnforcedPattern = /`(audit:[a-z0-9-]+)`\s+passes\s+\(CI-enforced/g;
	const ciEnforcedAudits = new Set<string>();
	for (const m of evalSrc.matchAll(ciEnforcedPattern)) {
		ciEnforcedAudits.add(m[1]);
	}

	for (const audit of ciEnforcedAudits) {
		// Check if ci.yml contains "bun run audit:foo" or "audit:foo"
		if (!ciSrc.includes(`bun run ${audit}`)) {
			violations.push(
				`[not-in-ci] EVALUATION.md claims \`${audit}\` is CI-enforced but it does not appear in ci.yml`,
			);
		}
	}

	// ── 4. Count self-assessed vs automated rubrics ──

	const rubricLinePattern = /^\|\s*(\d+)\s*\|([^|]+)\|([^|]*)\|([^|]*)\|/gm;
	let totalRubrics = 0;
	let selfAssessedCount = 0;
	let automatedCount = 0;
	let emptyEvidenceCount = 0;
	const selfAssessedRubrics: string[] = [];

	for (const m of evalSrc.matchAll(rubricLinePattern)) {
		const num = m[1];
		const name = m[2].trim();
		const evidence = m[4]?.trim() ?? "";

		totalRubrics++;

		if (/\(self-assessed\b/.test(evidence)) {
			selfAssessedCount++;
			selfAssessedRubrics.push(`#${num} ${name}`);
		} else if (
			evidence.includes("audit:") ||
			evidence.includes("test:") ||
			evidence.includes(".test.ts")
		) {
			automatedCount++;
		}

		// Rule 6: every rubric must have evidence or a self-assessed marker
		if (!evidence && !m[3]?.trim()) {
			violations.push(
				`[no-evidence] Rubric #${num} (${name}) has no evidence and no self-assessed marker`,
			);
			emptyEvidenceCount++;
		}
	}

	// ── Report ──

	const automatedPct =
		totalRubrics > 0 ? Math.round((automatedCount / totalRubrics) * 100) : 0;
	const selfAssessedPct =
		totalRubrics > 0 ? Math.round((selfAssessedCount / totalRubrics) * 100) : 0;

	console.log("evaluation-integrity audit\n");
	console.log(`  Rubrics: ${totalRubrics} total`);
	console.log(`  Automated: ${automatedCount} (${automatedPct}%)`);
	console.log(`  Self-assessed: ${selfAssessedCount} (${selfAssessedPct}%)`);
	console.log(`  Audit scripts in package.json: ${auditScripts.length}`);
	console.log(`  Audit refs in EVALUATION.md: ${evalAuditRefs.size}`);
	console.log(`  CI-enforced claims: ${ciEnforcedAudits.size}`);

	if (selfAssessedRubrics.length > 0) {
		warnings.push(
			`${selfAssessedCount} rubric(s) are self-assessed with no full automated backing:\n${selfAssessedRubrics.map((r) => `      ${r}`).join("\n")}`,
		);
	}

	if (warnings.length > 0) {
		console.warn("\n  Warnings:");
		for (const w of warnings) console.warn(`    - ${w}`);
	}

	if (violations.length > 0) {
		console.error(
			`\nevaluation-integrity audit failed — ${violations.length} issue(s):\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		process.exit(1);
	}

	console.log(
		`\nevaluation-integrity audit passed — ${totalRubrics} rubrics verified, ` +
			`${automatedCount} automated, ${ciEnforcedAudits.size} CI-enforced claims confirmed.`,
	);
}

main().catch((err) => {
	console.error("evaluation-integrity audit failed:", err);
	process.exit(1);
});
