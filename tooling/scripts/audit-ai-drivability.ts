// Rubric 18 (AI Drivability)
/**
 * AI Drivability Audit
 *
 * Verifies that the repo meets AI-drivability requirements:
 *   1. AGENTS.md exists at repo root with key sections
 *   2. llms.txt exists at repo root
 *   3. MCP package exists (packages/astropress-mcp/package.json)
 *   4. platform-contracts.ts has sufficient JSDoc coverage (>= 20 blocks)
 *   5. api-middleware.ts contains no generic/banned error messages
 */

import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

async function main() {
	const report = new AuditReport("ai-drivability");

	// 1. AGENTS.md exists and contains key sections
	const agentsMdPath = fromRoot("AGENTS.md");
	if (!(await fileExists(agentsMdPath))) {
		report.add("[agents-md-missing] AGENTS.md does not exist at repo root");
	} else {
		const content = await readText(agentsMdPath);
		const requiredSections = [
			"Key contracts",
			"arch-lint",
			"Security invariants",
			"No speculative features",
		];
		for (const section of requiredSections) {
			if (!content.includes(section)) {
				report.add(
					`[agents-md-section] AGENTS.md is missing required section: "${section}"`,
				);
			}
		}
	}

	// 2. llms.txt exists
	const llmsTxtPath = fromRoot("llms.txt");
	if (!(await fileExists(llmsTxtPath))) {
		report.add("[llms-txt-missing] llms.txt does not exist at repo root");
	}

	// 3. MCP package exists
	const mcpPkgPath = fromRoot("packages/astropress-mcp/package.json");
	if (!(await fileExists(mcpPkgPath))) {
		report.add(
			"[mcp-package-missing] packages/astropress-mcp/package.json does not exist",
		);
	}

	// 4. platform-contracts.ts has >= 20 JSDoc comment blocks
	const contractsPath = fromRoot("packages/astropress/src/platform-contracts.ts");
	if (!(await fileExists(contractsPath))) {
		report.add(
			"[contracts-missing] packages/astropress/src/platform-contracts.ts does not exist",
		);
	} else {
		const src = await readText(contractsPath);
		const lines = src.split("\n");
		const jsdocLineCount = lines.filter(
			(line) => /^\s*\/\*\*/.test(line) || /^\s*\*\s/.test(line),
		).length;
		if (jsdocLineCount < 20) {
			report.add(
				`[jsdoc-coverage] packages/astropress/src/platform-contracts.ts has only ${jsdocLineCount} JSDoc lines (need >= 20)`,
			);
		}
	}

	// 5. No generic error messages in api-middleware.ts
	const middlewarePath = fromRoot("packages/astropress/src/api-middleware.ts");
	if (!(await fileExists(middlewarePath))) {
		report.add(
			"[middleware-missing] packages/astropress/src/api-middleware.ts does not exist",
		);
	} else {
		const src = await readText(middlewarePath);
		const lines = src.split("\n");
		const bannedPhrases = [
			"Something went wrong",
			"An error occurred",
			"Unknown error",
			"Please try again",
		];
		for (let i = 0; i < lines.length; i++) {
			for (const phrase of bannedPhrases) {
				if (lines[i].toLowerCase().includes(phrase.toLowerCase())) {
					report.add(
						`[generic-error] packages/astropress/src/api-middleware.ts:${i + 1}: contains banned phrase "${phrase}"\n    → ${lines[i].trim()}`,
					);
				}
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nFix: ensure AGENTS.md, llms.txt, and MCP package exist; add JSDoc to platform contracts; remove generic error messages.",
		);
	}

	report.finish("ai-drivability audit passed — all AI-drivability checks OK.");
}

runAudit("ai-drivability", main);
