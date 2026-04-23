// Rubric 30 (Open Source Health)
//
// Verifies that essential open-source health files exist at the repo root
// and contain expected content.

import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

async function readOptional(path: string): Promise<string | null> {
	if (!(await fileExists(path))) return null;
	return await readText(path);
}

async function main() {
	const report = new AuditReport("oss-health");

	// 1. LICENSE
	const license = await readOptional(fromRoot("LICENSE"));
	if (license === null) {
		report.add("[missing] LICENSE — file not found at repo root");
	} else if (!/MIT|Apache|ISC/i.test(license)) {
		report.add(
			'[invalid-license] LICENSE — does not contain "MIT", "Apache", or "ISC"',
		);
	}

	// 2. CONTRIBUTING.md
	const contributing = await readOptional(fromRoot("CONTRIBUTING.md"));
	if (contributing === null) {
		report.add("[missing] CONTRIBUTING.md — file not found at repo root");
	} else {
		const lower = contributing.toLowerCase();
		if (!(/setup/.test(lower) || /install/.test(lower))) {
			report.add(
				'[missing-section] CONTRIBUTING.md — does not mention "setup" or "install"',
			);
		}
		if (!/test/.test(lower)) {
			report.add(
				'[missing-section] CONTRIBUTING.md — does not mention "test"',
			);
		}
	}

	// 3. CODE_OF_CONDUCT.md
	if (!(await fileExists(fromRoot("CODE_OF_CONDUCT.md")))) {
		report.add("[missing] CODE_OF_CONDUCT.md — file not found at repo root");
	}

	// 4. SECURITY.md
	const security = await readOptional(fromRoot("SECURITY.md"));
	if (security === null) {
		report.add("[missing] SECURITY.md — file not found at repo root");
	} else if (!/vulnerability|responsible\s+disclosure|report/i.test(security)) {
		report.add(
			'[invalid-content] SECURITY.md — does not mention "vulnerability", "responsible disclosure", or "report"',
		);
	}

	// 5. CHANGELOG.md
	if (!(await fileExists(fromRoot("CHANGELOG.md")))) {
		report.add("[missing] CHANGELOG.md — file not found at repo root");
	}

	// 6. .github/ISSUE_TEMPLATE/ — directory with at least 1 .md file
	const issueTemplateDir = fromRoot(".github/ISSUE_TEMPLATE");
	if (!(await fileExists(issueTemplateDir))) {
		report.add("[missing] .github/ISSUE_TEMPLATE/ — directory not found");
	} else {
		const entries = await listFiles(issueTemplateDir);
		const mdFiles = entries.filter((e) => e.endsWith(".md"));
		if (mdFiles.length === 0) {
			report.add(
				"[empty] .github/ISSUE_TEMPLATE/ — directory exists but contains no .md files",
			);
		}
	}

	// 7. README.md — exists and is at least 100 lines
	const readme = await readOptional(fromRoot("README.md"));
	if (readme === null) {
		report.add("[missing] README.md — file not found at repo root");
	} else {
		const lineCount = readme.split("\n").length;
		if (lineCount < 100) {
			report.add(
				`[too-short] README.md — ${lineCount} lines (minimum 100 required)`,
			);
		}
	}

	if (report.failed) {
		console.error(
			"\nFix: add or update the missing/invalid files at the repo root.",
		);
	}

	report.finish(
		"oss-health audit passed — all open-source health files present and valid.",
	);
}

runAudit("oss-health", main);
