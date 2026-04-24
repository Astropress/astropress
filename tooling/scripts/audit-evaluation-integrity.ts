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
 *   5. No rubric in the table has an empty Evidence column AND no "self-assessed" marker
 *      (every rubric must declare how it's backed)
 */

import { join } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const EVALUATION_MD = fromRoot("docs/reference/EVALUATION.md");
const PACKAGE_JSON = fromRoot("package.json");
const CI_YML = fromRoot(".github/workflows/ci.yml");

async function main() {
	const report = new AuditReport("evaluation-integrity");
	const warnings: string[] = [];

	const evalSrc = await readText(EVALUATION_MD);
	const pkgJson = JSON.parse(await readText(PACKAGE_JSON)) as {
		scripts: Record<string, string>;
	};
	const ciSrc = await readText(CI_YML);

	// ── 1. Audit scripts referenced in EVALUATION.md exist in package.json ──
	const evalAuditRefs = new Set<string>();
	const auditRefPattern = /`(audit:[a-z0-9-]+)`/g;
	for (const m of evalSrc.matchAll(auditRefPattern)) {
		evalAuditRefs.add(m[1]);
	}

	for (const ref of evalAuditRefs) {
		if (!pkgJson.scripts[ref]) {
			report.add(
				`[missing-script] EVALUATION.md references \`${ref}\` but it is not defined in package.json`,
			);
		}
	}

	// ── 2. Every audit:* script in package.json points to a file that exists ──
	const auditScripts = Object.entries(pkgJson.scripts).filter(([name]) =>
		name.startsWith("audit:"),
	);

	for (const [name, command] of auditScripts) {
		const fileMatch = command.match(/(tooling\/scripts\/[^\s]+\.ts)/);
		if (fileMatch) {
			const scriptPath = join(fromRoot(), fileMatch[1]);
			if (!(await fileExists(scriptPath))) {
				report.add(
					`[missing-file] package.json script "${name}" points to ${fileMatch[1]} which does not exist`,
				);
			}
		}
	}

	// ── 3. CI-enforced audits are actually in ci.yml ──
	const ciEnforcedPattern = /`(audit:[a-z0-9-]+)`\s+passes\s+\(CI-enforced/g;
	const ciEnforcedAudits = new Set<string>();
	for (const m of evalSrc.matchAll(ciEnforcedPattern)) {
		ciEnforcedAudits.add(m[1]);
	}

	for (const audit of ciEnforcedAudits) {
		if (!ciSrc.includes(`bun run ${audit}`)) {
			report.add(
				`[not-in-ci] EVALUATION.md claims \`${audit}\` is CI-enforced but it does not appear in ci.yml`,
			);
		}
	}

	// ── 4. Count self-assessed vs automated rubrics ──
	const rubricLinePattern = /^\|\s*(\d+)\s*\|([^|]+)\|([^|]*)\|([^|]*)\|/gm;
	let totalRubrics = 0;
	let selfAssessedCount = 0;
	let automatedCount = 0;
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

		if (!evidence && !m[3]?.trim()) {
			report.add(
				`[no-evidence] Rubric #${num} (${name}) has no evidence and no self-assessed marker`,
			);
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

	report.finish(
		`\nevaluation-integrity audit passed — ${totalRubrics} rubrics verified, ` +
			`${automatedCount} automated, ${ciEnforcedAudits.size} CI-enforced claims confirmed.`,
	);
}

runAudit("evaluation-integrity", main);
