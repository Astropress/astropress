// Rubric 19 (Internationalization)
//
// Static analysis audit that verifies core i18n modules, translation state,
// exported symbols, BDD scenario file, and test file all exist as expected.

import {
	AuditReport,
	fileContains,
	fileExists,
	fromRoot,
	runAudit,
} from "../lib/audit-utils.js";

async function main() {
	const report = new AuditReport("i18n");

	const coreModules = [
		"packages/astropress/src/locale-links.ts",
		"packages/astropress/src/admin-locale-links.ts",
		"packages/astropress/src/admin-i18n.ts",
		"packages/astropress/src/translation-state.ts",
	];
	for (const mod of coreModules) {
		if (!(await fileExists(fromRoot(mod)))) {
			report.add(`[missing-module] ${mod} does not exist`);
		}
	}

	const localeLinksPath = fromRoot("packages/astropress/src/locale-links.ts");
	if (await fileExists(localeLinksPath)) {
		if (!(await fileContains(localeLinksPath, /canonicalUrlForRoute/))) {
			report.add(
				"[missing-export] packages/astropress/src/locale-links.ts does not contain canonicalUrlForRoute",
			);
		}
		if (!(await fileContains(localeLinksPath, /getAlternateLinksForEnglishRoute/))) {
			report.add(
				"[missing-export] packages/astropress/src/locale-links.ts does not contain getAlternateLinksForEnglishRoute",
			);
		}
	}

	const adminI18nPath = fromRoot("packages/astropress/src/admin-i18n.ts");
	if (await fileExists(adminI18nPath)) {
		const hasStrings = await fileContains(adminI18nPath, /defaultAdminStrings/);
		const hasType = await fileContains(adminI18nPath, /AstropressAdminStringKey/);
		if (!hasStrings && !hasType) {
			report.add(
				"[missing-export] packages/astropress/src/admin-i18n.ts does not contain defaultAdminStrings or AstropressAdminStringKey",
			);
		}
	}

	if (!(await fileExists(fromRoot("tooling/bdd/admin/i18n.feature")))) {
		report.add("[missing-bdd] tooling/bdd/admin/i18n.feature does not exist");
	}

	if (!(await fileExists(fromRoot("packages/astropress/tests/locale-links.test.ts")))) {
		report.add("[missing-test] packages/astropress/tests/locale-links.test.ts does not exist");
	}

	report.finish(
		"i18n audit passed — all core modules, exports, BDD features, and tests verified.",
	);
}

runAudit("i18n", main);
