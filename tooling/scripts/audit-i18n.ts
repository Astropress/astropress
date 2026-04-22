// Rubric 19 (Internationalization)
//
// Static analysis audit that verifies core i18n modules, translation state,
// exported symbols, BDD scenario file, and test file all exist as expected.

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function fileContains(
	filePath: string,
	pattern: RegExp,
): Promise<boolean> {
	try {
		const src = await readFile(filePath, "utf8");
		return pattern.test(src);
	} catch {
		return false;
	}
}

async function main() {
	const violations: string[] = [];

	// 1. Core i18n modules exist
	const coreModules = [
		"packages/astropress/src/locale-links.ts",
		"packages/astropress/src/admin-locale-links.ts",
		"packages/astropress/src/admin-i18n.ts",
	];

	for (const mod of coreModules) {
		const fullPath = join(root, mod);
		if (!(await fileExists(fullPath))) {
			violations.push(`[missing-module] ${mod} does not exist`);
		}
	}

	// 2. Translation state module exists
	const translationState = "packages/astropress/src/translation-state.ts";
	if (!(await fileExists(join(root, translationState)))) {
		violations.push(`[missing-module] ${translationState} does not exist`);
	}

	// 3. locale-links.ts exports canonicalUrlForRoute and getAlternateLinksForEnglishRoute
	const localeLinksPath = join(root, "packages/astropress/src/locale-links.ts");
	if (await fileExists(localeLinksPath)) {
		if (!(await fileContains(localeLinksPath, /canonicalUrlForRoute/))) {
			violations.push(
				"[missing-export] packages/astropress/src/locale-links.ts does not contain canonicalUrlForRoute",
			);
		}
		if (
			!(await fileContains(localeLinksPath, /getAlternateLinksForEnglishRoute/))
		) {
			violations.push(
				"[missing-export] packages/astropress/src/locale-links.ts does not contain getAlternateLinksForEnglishRoute",
			);
		}
	}

	// 4. admin-i18n.ts exports a default strings object or type
	const adminI18nPath = join(root, "packages/astropress/src/admin-i18n.ts");
	if (await fileExists(adminI18nPath)) {
		const hasStrings = await fileContains(adminI18nPath, /defaultAdminStrings/);
		const hasType = await fileContains(
			adminI18nPath,
			/AstropressAdminStringKey/,
		);
		if (!hasStrings && !hasType) {
			violations.push(
				"[missing-export] packages/astropress/src/admin-i18n.ts does not contain defaultAdminStrings or AstropressAdminStringKey",
			);
		}
	}

	// 5. BDD scenario file exists
	const bddFeature = "tooling/bdd/admin/i18n.feature";
	if (!(await fileExists(join(root, bddFeature)))) {
		violations.push(`[missing-bdd] ${bddFeature} does not exist`);
	}

	// 6. Test file exists
	const testFile = "packages/astropress/tests/locale-links.test.ts";
	if (!(await fileExists(join(root, testFile)))) {
		violations.push(`[missing-test] ${testFile} does not exist`);
	}

	if (violations.length > 0) {
		console.error(`i18n audit failed — ${violations.length} issue(s):\n`);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: ensure all i18n modules, exports, BDD features, and tests are present.",
		);
		process.exit(1);
	}

	console.log(
		"i18n audit passed — all core modules, exports, BDD features, and tests verified.",
	);
}

main().catch((err) => {
	console.error("i18n audit failed:", err);
	process.exit(1);
});
