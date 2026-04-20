// Rubric 30 (Open Source Health)
//
// Verifies that essential open-source health files exist at the repo root
// and contain expected content. Checks:
//   1. LICENSE — contains "MIT", "Apache", or "ISC"
//   2. CONTRIBUTING.md — contains "setup"/"install" and "test"
//   3. CODE_OF_CONDUCT.md — exists
//   4. SECURITY.md — mentions "vulnerability", "responsible disclosure", or "report"
//   5. CHANGELOG.md — exists
//   6. .github/ISSUE_TEMPLATE/ — directory with at least 1 .md file
//   7. README.md — exists and is at least 100 lines

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function fileExists(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return null;
	}
}

async function main() {
	const violations: string[] = [];

	// 1. LICENSE
	const license = await fileExists(join(root, "LICENSE"));
	if (license === null) {
		violations.push("[missing] LICENSE — file not found at repo root");
	} else if (!/MIT|Apache|ISC/i.test(license)) {
		violations.push(
			'[invalid-license] LICENSE — does not contain "MIT", "Apache", or "ISC"',
		);
	}

	// 2. CONTRIBUTING.md
	const contributing = await fileExists(join(root, "CONTRIBUTING.md"));
	if (contributing === null) {
		violations.push("[missing] CONTRIBUTING.md — file not found at repo root");
	} else {
		const lower = contributing.toLowerCase();
		if (!(/setup/.test(lower) || /install/.test(lower))) {
			violations.push(
				'[missing-section] CONTRIBUTING.md — does not mention "setup" or "install"',
			);
		}
		if (!/test/.test(lower)) {
			violations.push(
				'[missing-section] CONTRIBUTING.md — does not mention "test"',
			);
		}
	}

	// 3. CODE_OF_CONDUCT.md
	const coc = await fileExists(join(root, "CODE_OF_CONDUCT.md"));
	if (coc === null) {
		violations.push(
			"[missing] CODE_OF_CONDUCT.md — file not found at repo root",
		);
	}

	// 4. SECURITY.md
	const security = await fileExists(join(root, "SECURITY.md"));
	if (security === null) {
		violations.push("[missing] SECURITY.md — file not found at repo root");
	} else if (!/vulnerability|responsible\s+disclosure|report/i.test(security)) {
		violations.push(
			'[invalid-content] SECURITY.md — does not mention "vulnerability", "responsible disclosure", or "report"',
		);
	}

	// 5. CHANGELOG.md
	const changelog = await fileExists(join(root, "CHANGELOG.md"));
	if (changelog === null) {
		violations.push("[missing] CHANGELOG.md — file not found at repo root");
	}

	// 6. .github/ISSUE_TEMPLATE/ — directory with at least 1 .md file
	const issueTemplateDir = join(root, ".github/ISSUE_TEMPLATE");
	try {
		const entries = await readdir(issueTemplateDir);
		const mdFiles = entries.filter((e) => e.endsWith(".md"));
		if (mdFiles.length === 0) {
			violations.push(
				"[empty] .github/ISSUE_TEMPLATE/ — directory exists but contains no .md files",
			);
		}
	} catch {
		violations.push("[missing] .github/ISSUE_TEMPLATE/ — directory not found");
	}

	// 7. README.md — exists and is at least 100 lines
	const readme = await fileExists(join(root, "README.md"));
	if (readme === null) {
		violations.push("[missing] README.md — file not found at repo root");
	} else {
		const lineCount = readme.split("\n").length;
		if (lineCount < 100) {
			violations.push(
				`[too-short] README.md — ${lineCount} lines (minimum 100 required)`,
			);
		}
	}

	if (violations.length > 0) {
		console.error(`oss-health audit failed — ${violations.length} issue(s):\n`);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: add or update the missing/invalid files at the repo root.",
		);
		process.exit(1);
	}

	console.log(
		"oss-health audit passed — all open-source health files present and valid.",
	);
}

main().catch((err) => {
	console.error("oss-health audit failed:", err);
	process.exit(1);
});
