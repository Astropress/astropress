/**
 * Verify that the audit + Playwright registries are in lockstep
 * with the four call sites that traditionally drift:
 *
 *   - package.json (audit:<name> scripts, test:acceptance project list)
 *   - lefthook.yml (pre-commit audit jobs)
 *   - .github/workflows/ci.yml (`bun run audit:<name>` invocations)
 *   - tooling/e2e/playwright.config.ts (project names)
 *
 * The audit is intentionally narrow: it only enforces lockstep for
 * entries listed in `tooling/audit-registry.ts` /
 * `tooling/playwright-registry.ts`. Migration is incremental.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AUDITS } from "../audit-registry.js";
import { PLAYWRIGHT_PROJECTS } from "../playwright-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

interface Issue {
	readonly file: string;
	readonly message: string;
}

function readUtf8(path: string): string {
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf8");
}

function checkAudits(): Issue[] {
	const issues: Issue[] = [];
	const pkg = JSON.parse(readUtf8(join(ROOT, "package.json"))) as {
		scripts?: Record<string, string>;
	};
	const scripts = pkg.scripts ?? {};
	const lefthook = readUtf8(join(ROOT, "lefthook.yml"));
	const ci = readUtf8(join(ROOT, ".github/workflows/ci.yml"));

	for (const audit of AUDITS) {
		const scriptKey = `audit:${audit.name}`;
		const expectedCommand = `bun run ${audit.script}`;
		const actual = scripts[scriptKey];
		if (!actual) {
			issues.push({
				file: "package.json",
				message: `missing scripts["${scriptKey}"] = "${expectedCommand}"`,
			});
		} else if (!actual.includes(audit.script)) {
			issues.push({
				file: "package.json",
				message: `scripts["${scriptKey}"] = ${JSON.stringify(actual)} does not invoke ${audit.script}`,
			});
		}

		if (audit.preCommit) {
			const jobMarker = `audit-${audit.name}:`;
			if (!lefthook.includes(jobMarker)) {
				issues.push({
					file: "lefthook.yml",
					message: `pre-commit job "${jobMarker}" not found (registry says preCommit=true)`,
				});
			}
		}

		if (audit.ci) {
			if (!ci.includes(scriptKey)) {
				issues.push({
					file: ".github/workflows/ci.yml",
					message: `expected "bun run ${scriptKey}" invocation; ci=true in registry`,
				});
			}
		}

		if (!existsSync(join(ROOT, audit.script))) {
			issues.push({
				file: audit.script,
				message: "script file does not exist on disk",
			});
		}
	}

	return issues;
}

function checkPlaywright(): Issue[] {
	const issues: Issue[] = [];
	const pkg = JSON.parse(readUtf8(join(ROOT, "package.json"))) as {
		scripts?: Record<string, string>;
	};
	const acceptance = pkg.scripts?.["test:acceptance"] ?? "";
	const playwrightConfigPath = join(ROOT, "tooling/e2e/playwright.config.ts");
	const playwrightConfig = readUtf8(playwrightConfigPath);

	for (const project of PLAYWRIGHT_PROJECTS) {
		if (!playwrightConfig.includes(`name: "${project.name}"`)) {
			issues.push({
				file: "tooling/e2e/playwright.config.ts",
				message: `project "${project.name}" not declared in playwright.config.ts`,
			});
		}
		if (project.inAcceptanceMatrix) {
			if (!acceptance.includes(project.name)) {
				issues.push({
					file: "package.json",
					message: `scripts["test:acceptance"] does not include "${project.name}" (inAcceptanceMatrix=true)`,
				});
			}
		}
	}

	return issues;
}

function main(): number {
	const issues = [...checkAudits(), ...checkPlaywright()];
	if (issues.length === 0) {
		console.log(
			`registry-sync audit passed (${AUDITS.length} audit(s), ${PLAYWRIGHT_PROJECTS.length} playwright project(s) tracked).`,
		);
		return 0;
	}
	console.error(`registry-sync audit failed — ${issues.length} issue(s):\n`);
	for (const issue of issues) {
		console.error(`  - ${issue.file}: ${issue.message}`);
	}
	console.error(
		"\nUpdate tooling/audit-registry.ts or tooling/playwright-registry.ts " +
			"to match the call sites, or update the call sites to match the registry.",
	);
	return 1;
}

process.exit(main());
