// Rubric 45 (Scaffold Quality Carryover)
/**
 * Scaffold Quality Audit
 *
 * Verifies that the project scaffold modules exist and include the expected
 * quality, security, and health-check steps in their generated CI pipelines.
 *
 * Note: the passphrase generation module is NOT checked here — CodeQL marks
 * any reference to it as sensitive. Its existence and crypto quality are
 * verified by project-scaffold.test.ts and audit:crypto instead.
 */

import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const SCAFFOLD_MODULE = fromRoot("packages/astropress/src/project-scaffold.ts");
const CI_MODULE = fromRoot("packages/astropress/src/project-scaffold-ci.ts");
const TEST_FILE = fromRoot(
	"packages/astropress/tests/project-scaffold.test.ts",
);

function grepQuiet(filePath: string, pattern: string): boolean {
	try {
		execFileSync("grep", ["-qiE", pattern, filePath], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const report = new AuditReport("scaffold-quality");

	// 1. Scaffold module exists and exports createAstropressProjectScaffold
	if (!(await fileExists(SCAFFOLD_MODULE))) {
		report.add(
			`[missing-scaffold] ${relative(ROOT, SCAFFOLD_MODULE)} does not exist`,
		);
	} else if (!grepQuiet(SCAFFOLD_MODULE, "createAstropressProjectScaffold")) {
		report.add(
			`[missing-export] ${relative(ROOT, SCAFFOLD_MODULE)} does not export createAstropressProjectScaffold`,
		);
	}

	// 2. CI scaffold module exists
	const ciExists = await fileExists(CI_MODULE);
	if (!ciExists) {
		report.add(
			`[missing-ci-module] ${relative(ROOT, CI_MODULE)} does not exist`,
		);
	}

	// 3. CI scaffold includes security scanning
	if (ciExists && !grepQuiet(CI_MODULE, "security|trivy|semgrep")) {
		report.add(
			`[missing-security] ${relative(ROOT, CI_MODULE)} does not reference security scanning`,
		);
	}

	// 4. CI scaffold includes linting / quality
	if (ciExists && !grepQuiet(CI_MODULE, "lint|biome|check")) {
		report.add(
			`[missing-lint] ${relative(ROOT, CI_MODULE)} does not reference linting`,
		);
	}

	// 5. CI scaffold includes doctor health check
	if (ciExists && !grepQuiet(CI_MODULE, "doctor")) {
		report.add(
			`[missing-doctor] ${relative(ROOT, CI_MODULE)} does not reference doctor health check`,
		);
	}

	// 6. Test file exists
	if (!(await fileExists(TEST_FILE))) {
		report.add(`[missing-test] ${relative(ROOT, TEST_FILE)} does not exist`);
	}

	report.finish(
		"scaffold-quality audit passed — all scaffold modules present with security, quality, and health-check coverage.",
	);
}

runAudit("scaffold-quality", main);
