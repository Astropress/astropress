import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Rubrics 50 (Information Architecture) + 51 (Navigation Design)
//
// Verifies:
//   1. admin.css has a .skip-link class AND .skip-link:focus rule (keyboard-accessible skip nav)
//   2. admin.css uses [aria-current="page"] selector (active-page indicator)
//   3. admin-nav.ts handles the Escape key (keyboard sidebar dismiss)
//   4. admin-ui.ts AstropressAdminNavKey type includes minimum required nav keys
//   5. At least one admin page file has breadcrumb markup (aria-label="breadcrumb" or class="breadcrumb")
//   6. CLI commands follow the noun verb pattern (services/db/auth + verb subcommand)
//   7. `astropress list tools` (or `ls tools`) command is discoverable

const root = process.cwd();
const ADMIN_CSS = join(root, "packages/astropress/public/admin.css");
const ADMIN_NAV_WC = join(
	root,
	"packages/astropress/web-components/admin-nav.ts",
);
const ADMIN_UI_TS = join(root, "packages/astropress/src/admin-ui.ts");
const PAGES_DIR = join(root, "packages/astropress/pages");
const CLI_ARGS_MOD = join(root, "crates/astropress-cli/src/cli_config/args/mod.rs");

// Noun-verb pairs that must appear in CLI dispatch (Rubric 50: CLI commands follow noun verb pattern)
const REQUIRED_CLI_NOUN_VERBS = [
  ["services", "bootstrap"],
  ["db", "migrate"],
  ["auth", "emergency-revoke"],
];

// Minimum set of nav keys that must be present in AstropressAdminNavKey
const REQUIRED_NAV_KEYS = ["dashboard", "settings", "pages", "posts", "media"];

async function findBreadcrumbFile(dir: string): Promise<string | null> {
	let entries: string[];
	try {
		entries = await readdir(dir, { recursive: true });
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (
			!entry.endsWith(".astro") &&
			!entry.endsWith(".ts") &&
			!entry.endsWith(".html")
		)
			continue;
		const src = await readFile(join(dir, entry), "utf8").catch(() => "");
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
	const [adminCss, adminNavSrc, adminUiSrc] = await Promise.all([
		readFile(ADMIN_CSS, "utf8"),
		readFile(ADMIN_NAV_WC, "utf8"),
		readFile(ADMIN_UI_TS, "utf8"),
	]);

	const violations: string[] = [];

	// 1. Skip-link class exists in admin.css
	if (!adminCss.includes(".skip-link")) {
		violations.push(
			"admin.css: missing .skip-link class — skip-navigation link required for keyboard accessibility",
		);
	}
	if (!adminCss.includes(".skip-link:focus")) {
		violations.push(
			"admin.css: missing .skip-link:focus rule — skip link must be visible when focused",
		);
	}

	// 2. aria-current="page" selector in admin.css (active-page indicator)
	if (
		!adminCss.includes('[aria-current="page"]') &&
		!adminCss.includes("[aria-current='page']") &&
		!adminCss.includes("[aria-current=page]")
	) {
		violations.push(
			'admin.css: missing [aria-current="page"] selector — active-page indicator required in sidebar nav',
		);
	}

	// 3. Escape key handling in admin-nav.ts
	if (
		!adminNavSrc.includes('"Escape"') &&
		!adminNavSrc.includes("'Escape'") &&
		!adminNavSrc.includes('e.key === "Escape"')
	) {
		violations.push(
			"web-components/admin-nav.ts: Escape key not handled — sidebar must be dismissible by keyboard",
		);
	}

	// 4. AstropressAdminNavKey type includes required keys
	for (const key of REQUIRED_NAV_KEYS) {
		if (!adminUiSrc.includes(`"${key}"`) && !adminUiSrc.includes(`'${key}'`)) {
			violations.push(
				`admin-ui.ts: AstropressAdminNavKey missing required key "${key}"`,
			);
		}
	}

	// 5. Breadcrumb markup exists in at least one admin page
	const breadcrumbFile = await findBreadcrumbFile(PAGES_DIR);
	if (!breadcrumbFile) {
		violations.push(
			'pages/: no file found with aria-label="breadcrumb" or class="breadcrumb" — breadcrumbs required for pages ≥ 2 levels deep',
		);
	}

	// 6. CLI noun-verb pattern and list-tools discoverability
	const cliArgsSrc = await readFile(CLI_ARGS_MOD, "utf8").catch(() => "");
	if (!cliArgsSrc) {
		violations.push("crates/astropress-cli/src/cli_config/args/mod.rs: file not found — cannot verify CLI noun-verb structure");
	} else {
		for (const [noun, verb] of REQUIRED_CLI_NOUN_VERBS) {
			const hasNounVerb =
				cliArgsSrc.includes(`"${noun}" && subcommand == "${verb}"`) ||
				cliArgsSrc.includes(`command == "${noun}"`) && cliArgsSrc.includes(`"${verb}"`);
			if (!hasNounVerb) {
				violations.push(`CLI: expected "${noun} ${verb}" noun-verb command not found in args/mod.rs`);
			}
		}

		// 7. `astropress list tools` must be a discoverable entry point
		if (!cliArgsSrc.includes("ListTools") && !cliArgsSrc.includes('"list"') && !cliArgsSrc.includes('"ls"')) {
			violations.push("CLI: `astropress list tools` command not found — required entry point for discovering available options (Rubric 50)");
		}
	}

	if (violations.length > 0) {
		console.error("navigation audit failed:\n");
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	console.log(
		`navigation audit passed — skip-link, aria-current, Escape key, nav keys (${REQUIRED_NAV_KEYS.join(", ")}), breadcrumbs, CLI noun-verb pattern, and list-tools all verified.`,
	);
}

main().catch((err) => {
	console.error("navigation audit failed:", err);
	process.exit(1);
});
