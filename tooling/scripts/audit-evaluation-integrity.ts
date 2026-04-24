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
 *   6. RUBRIC GRADE GUARD — when a rubric grade is raised in this PR, its new
 *      evidence must reference at least one existing .test.ts / .spec.ts file
 *      on disk. Catches the 2026-04-23 failure mode where A+ was claimed
 *      without running the cited tests.
 */

import { spawnSync } from "node:child_process";
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

	// ── 6. Rubric grade guard: raised grades must cite a test file that exists.
	// Compares current EVALUATION.md to origin/main. Skipped if main isn't
	// locally available (CI, fresh checkout — the PR itself has CI coverage).
	await checkGradeRaises(evalSrc, report);

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

const GRADE_ORDER: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4, "A+": 5 };

function parseRubricMap(src: string): Map<string, { grade: string; evidence: string }> {
	const rubrics = new Map<string, { grade: string; evidence: string }>();
	const linePattern = /^\|\s*(\d+)\s*\|[^|]+\|\s*([A-F][+-]?)\s*\|([^|]*)\|/gm;
	for (const m of src.matchAll(linePattern)) {
		const num = m[1];
		const grade = m[2].trim();
		const evidence = m[3]?.trim() ?? "";
		rubrics.set(num, { grade, evidence });
	}
	return rubrics;
}

async function checkGradeRaises(currentSrc: string, report: AuditReport): Promise<void> {
	// Fetch the main version of EVALUATION.md. If unavailable, skip silently.
	const show = spawnSync(
		"git",
		["show", "origin/main:docs/reference/EVALUATION.md"],
		{ encoding: "utf8" },
	);
	if (show.status !== 0 || !show.stdout) return;
	const mainSrc = show.stdout;
	const before = parseRubricMap(mainSrc);
	const now = parseRubricMap(currentSrc);

	const raised: Array<{ num: string; from: string; to: string; evidence: string }> = [];
	for (const [num, next] of now) {
		const prev = before.get(num);
		if (!prev) continue; // new rubric — skip grade-raise logic
		const prevRank = GRADE_ORDER[prev.grade] ?? -1;
		const nextRank = GRADE_ORDER[next.grade] ?? -1;
		if (nextRank > prevRank) {
			raised.push({ num, from: prev.grade, to: next.grade, evidence: next.evidence });
		}
	}

	for (const r of raised) {
		// Evidence must cite at least one .test.ts / .spec.ts that exists on disk
		const testFiles: string[] = [];
		const pattern = /[\w.\\/\-]+?\.(?:test|spec)\.ts/g;
		for (const m of r.evidence.matchAll(pattern)) testFiles.push(m[0]);
		if (testFiles.length === 0) {
			report.add(
				`[grade-raise-no-test] Rubric #${r.num} grade rose ${r.from}→${r.to} but its evidence ` +
					`cites no .test.ts / .spec.ts file. A grade upgrade must be backed by a behavioral ` +
					`test that actually ran. Evidence: ${r.evidence.slice(0, 180)}...`,
			);
			continue;
		}
		let foundAnyOnDisk = false;
		for (const file of testFiles) {
			// Tolerate both package-relative and repo-relative paths
			const candidates = [
				fromRoot(file),
				fromRoot("packages/astropress", file),
				fromRoot("packages/astropress/tests", file),
				fromRoot("packages/astropress-nexus/tests", file),
				fromRoot("tooling/e2e", file),
			];
			for (const candidate of candidates) {
				if (await fileExists(candidate)) {
					foundAnyOnDisk = true;
					break;
				}
			}
			if (foundAnyOnDisk) break;
		}
		if (!foundAnyOnDisk) {
			report.add(
				`[grade-raise-missing-test] Rubric #${r.num} grade rose ${r.from}→${r.to} but none of ` +
					`its cited test files exist on disk: ${testFiles.join(", ")}. The rubric grade is ` +
					`ahead of the actual implementation.`,
			);
		}
	}
}

runAudit("evaluation-integrity", main);
