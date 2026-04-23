// Rubrics 50 (Information Architecture) + 51 (Navigation Design)
//
// Verifies:
//   1. admin.css has a .skip-link class AND .skip-link:focus rule (keyboard-accessible skip nav)
//   2. admin.css uses [aria-current="page"] selector (active-page indicator)
//   3. admin-nav.ts handles the Escape key (keyboard sidebar dismiss)
//   4. admin-ui.ts AstropressAdminNavKey type includes minimum required nav keys
//   5. At least one admin page file has breadcrumb markup
//   6. CLI commands follow the noun verb pattern
//   7. `astropress list tools` command is discoverable

import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const ADMIN_CSS = fromRoot("packages/astropress/public/admin.css");
const ADMIN_NAV_WC = fromRoot("packages/astropress/web-components/admin-nav.ts");
const ADMIN_UI_TS = fromRoot("packages/astropress/src/admin-ui.ts");
const PAGES_DIR = fromRoot("packages/astropress/pages");
const CLI_ARGS_MOD = fromRoot("crates/astropress-cli/src/cli_config/args/mod.rs");

const REQUIRED_CLI_NOUN_VERBS: readonly [string, string][] = [
	["services", "bootstrap"],
	["db", "migrate"],
	["auth", "emergency-revoke"],
];

const REQUIRED_NAV_KEYS = ["dashboard", "settings", "pages", "posts", "media"];

async function findBreadcrumbFile(dir: string): Promise<string | null> {
	const files = await listFiles(dir, {
		recursive: true,
		extensions: [".astro", ".ts", ".html"],
	});
	for (const entry of files) {
		const src = await readText(join(dir, entry));
		if (
			src.includes('aria-label="breadcrumb"') ||
			src.includes("aria-label='breadcrumb'") ||
			src.includes('class="breadcrumb"') ||
			src.includes("class='breadcrumb'")
		) {
			return entry;
		}
	}
	return null;
}

async function main() {
	const report = new AuditReport("navigation");
	const [adminCss, adminNavSrc, adminUiSrc] = await Promise.all([
		readText(ADMIN_CSS),
		readText(ADMIN_NAV_WC),
		readText(ADMIN_UI_TS),
	]);

	if (!adminCss.includes(".skip-link")) {
		report.add(
			"admin.css: missing .skip-link class — skip-navigation link required for keyboard accessibility",
		);
	}
	if (!adminCss.includes(".skip-link:focus")) {
		report.add(
			"admin.css: missing .skip-link:focus rule — skip link must be visible when focused",
		);
	}

	if (
		!adminCss.includes('[aria-current="page"]') &&
		!adminCss.includes("[aria-current='page']") &&
		!adminCss.includes("[aria-current=page]")
	) {
		report.add(
			'admin.css: missing [aria-current="page"] selector — active-page indicator required in sidebar nav',
		);
	}

	if (
		!adminNavSrc.includes('"Escape"') &&
		!adminNavSrc.includes("'Escape'") &&
		!adminNavSrc.includes('e.key === "Escape"')
	) {
		report.add(
			"web-components/admin-nav.ts: Escape key not handled — sidebar must be dismissible by keyboard",
		);
	}

	for (const key of REQUIRED_NAV_KEYS) {
		if (!adminUiSrc.includes(`"${key}"`) && !adminUiSrc.includes(`'${key}'`)) {
			report.add(`admin-ui.ts: AstropressAdminNavKey missing required key "${key}"`);
		}
	}

	const breadcrumbFile = await findBreadcrumbFile(PAGES_DIR);
	if (!breadcrumbFile) {
		report.add(
			'pages/: no file found with aria-label="breadcrumb" or class="breadcrumb" — breadcrumbs required for pages ≥ 2 levels deep',
		);
	}

	const cliArgsSrc = await readText(CLI_ARGS_MOD);
	if (!cliArgsSrc) {
		report.add(
			"crates/astropress-cli/src/cli_config/args/mod.rs: file not found — cannot verify CLI noun-verb structure",
		);
	} else {
		for (const [noun, verb] of REQUIRED_CLI_NOUN_VERBS) {
			const hasNounVerb =
				cliArgsSrc.includes(`"${noun}" && subcommand == "${verb}"`) ||
				(cliArgsSrc.includes(`command == "${noun}"`) && cliArgsSrc.includes(`"${verb}"`));
			if (!hasNounVerb) {
				report.add(`CLI: expected "${noun} ${verb}" noun-verb command not found in args/mod.rs`);
			}
		}
		if (
			!cliArgsSrc.includes("ListTools") &&
			!cliArgsSrc.includes('"list"') &&
			!cliArgsSrc.includes('"ls"')
		) {
			report.add(
				"CLI: `astropress list tools` command not found — required entry point for discovering available options (Rubric 50)",
			);
		}
	}

	report.finish(
		`navigation audit passed — skip-link, aria-current, Escape key, nav keys (${REQUIRED_NAV_KEYS.join(", ")}), breadcrumbs, CLI noun-verb pattern, and list-tools all verified.`,
	);
}

runAudit("navigation", main);
