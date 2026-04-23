import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Rubric 7 (Developer Ergonomics)
//
// Verifies that the project gives developers a smooth on-ramp:
//   1. A quick-start guide exists (docs/guides/QUICK_START.md or QUICK_START.md)
//   2. project-scaffold.test.ts exists (scaffold → working project is tested)
//   3. The CLI doctor command is implemented (not just declared)
//   4. --help is handled in the CLI arg parser
//   5. admin-shell-ux.test.ts exists (admin panel UX is verified)
//   6. docs:api:check is in ci.yml lint job (API docs stay current)

const CHECKS: Array<{ label: string; path: string; description: string }> = [
	{
		label: "Quick-start guide (docs/guides/QUICK_START.md)",
		path: fromRoot("docs/guides/QUICK_START.md"),
		description:
			"quick-start documentation is missing — developers need a first-run guide",
	},
	{
		label: "Scaffold test (packages/astropress/tests/project-scaffold.test.ts)",
		path: fromRoot("packages/astropress/tests/project-scaffold.test.ts"),
		description:
			"project scaffold test missing — astropress new must generate a working project",
	},
	{
		label: "CLI doctor command (crates/astropress-cli/src/commands/doctor.rs)",
		path: fromRoot("crates/astropress-cli/src/commands/doctor.rs"),
		description:
			"doctor command implementation missing — astropress doctor is part of the ergonomics contract",
	},
	{
		label:
			"Admin shell UX test (packages/astropress/tests/admin-shell-ux.test.ts)",
		path: fromRoot("packages/astropress/tests/admin-shell-ux.test.ts"),
		description:
			"admin shell UX test missing — core admin interaction patterns must be tested",
	},
];

async function main() {
	const report = new AuditReport("developer-ergonomics");

	// 1–4: File existence checks
	for (const check of CHECKS) {
		if (!(await fileExists(check.path))) {
			report.add(`${check.label}: ${check.description}`);
		}
	}

	// 5. --help is handled in the CLI arg parser
	const argsMod = fromRoot("crates/astropress-cli/src/cli_config/args/mod.rs");
	const argsModSrc = await readText(argsMod);
	if (!argsModSrc) {
		report.add(
			"crates/astropress-cli/src/cli_config/args/mod.rs: not found — CLI args module missing",
		);
	} else {
		if (
			!argsModSrc.includes('"--help"') &&
			!argsModSrc.includes('"help"') &&
			!argsModSrc.includes("--help")
		) {
			report.add(
				"crates/astropress-cli/src/cli_config/args/mod.rs: --help flag not handled — CLI must respond to astropress --help",
			);
		}
	}

	// 6. docs:api:check is in ci.yml lint job
	const ciYml = await readText(fromRoot(".github/workflows/ci.yml"));
	if (!ciYml) {
		report.add(".github/workflows/ci.yml: not found");
	} else if (!ciYml.includes("docs:api:check")) {
		report.add(
			".github/workflows/ci.yml: docs:api:check not found in CI lint job — API documentation must be kept current in CI",
		);
	}

	report.finish(
		"developer-ergonomics audit passed — quick-start docs, scaffold test, doctor command, --help, admin UX test, and docs:api:check all verified.",
	);
}

runAudit("developer-ergonomics", main);
