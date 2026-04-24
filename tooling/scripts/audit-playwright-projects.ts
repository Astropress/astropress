// Audit that every Playwright project declared in tooling/e2e/playwright.config.ts
// is wired into the test:acceptance script in package.json (and therefore runs
// in CI). The 2026-04-23 incident showed that missing a --project=foo argument
// silently excludes the test from CI — a new Playwright project passes locally
// (where `npx playwright test` runs everything) yet never executes in CI.
//
// Exempt projects that are explicitly tagged local-only via the comment marker
//   // audit-playwright: local-only
// on the line above their `{` in the config.

import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const PLAYWRIGHT_CONFIG = fromRoot("tooling/e2e/playwright.config.ts");
const PACKAGE_JSON = fromRoot("package.json");

async function main() {
	const report = new AuditReport("playwright-projects");
	const configSrc = await readText(PLAYWRIGHT_CONFIG);
	const pkgJson = JSON.parse(await readText(PACKAGE_JSON)) as {
		scripts: Record<string, string>;
	};

	// ── Parse projects from playwright.config.ts ──
	// Match the `name: "foo"` lines inside the projects array. Capture the
	// preceding 3 lines to detect the local-only opt-out marker.
	const lines = configSrc.split("\n");
	const projects: Array<{ name: string; localOnly: boolean; lineNumber: number }> = [];
	for (let i = 0; i < lines.length; i++) {
		const nameMatch = lines[i].match(/^\s*name:\s*"([^"]+)"/);
		if (!nameMatch) continue;
		// Context window: the 3 lines above might contain a local-only marker
		const context = lines.slice(Math.max(0, i - 3), i).join("\n");
		const localOnly = /audit-playwright:\s*local-only/.test(context);
		projects.push({ name: nameMatch[1], localOnly, lineNumber: i + 1 });
	}

	if (projects.length === 0) {
		report.add(
			"tooling/e2e/playwright.config.ts: no `name: \"...\"` entries detected — cannot audit",
		);
		report.finish("playwright-projects audit unreachable");
	}

	// ── Extract project args from test:acceptance ──
	const acceptanceCmd = pkgJson.scripts["test:acceptance"] ?? "";
	const wiredProjects = new Set<string>();
	for (const m of acceptanceCmd.matchAll(/--project=([\w-]+)/g)) {
		wiredProjects.add(m[1]);
	}

	// ── Cross-check ──
	for (const { name, localOnly, lineNumber } of projects) {
		if (localOnly) continue;
		if (!wiredProjects.has(name)) {
			report.add(
				`playwright.config.ts:${lineNumber}: project "${name}" is declared but not in ` +
					`test:acceptance. Either add --project=${name} to the script in package.json, or ` +
					`tag it with \`// audit-playwright: local-only\` above the object if it's not ` +
					`meant to run in CI.`,
			);
		}
	}

	// Also catch the reverse: test:acceptance references a project that no longer exists
	const projectNames = new Set(projects.map((p) => p.name));
	for (const wired of wiredProjects) {
		if (!projectNames.has(wired)) {
			report.add(
				`package.json test:acceptance references --project=${wired} but no such project ` +
					`exists in playwright.config.ts. Remove the stale --project arg or add the project.`,
			);
		}
	}

	report.finish(
		`playwright-projects audit passed — ${projects.length} projects declared, ` +
			`${wiredProjects.size} wired into test:acceptance.`,
	);
}

runAudit("playwright-projects", main);
