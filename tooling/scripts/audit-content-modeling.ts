// Rubric 23 (Content Modeling Flexibility)
//
// Static analysis audit that verifies the content modeling subsystem:
//
//   1. content-modeling.ts exists and exports validateContentFields
//   2. platform-contracts.ts contains ContentStoreRecord with a metadata field
//   3. content-modeling.ts references all required field types
//   4. content-modeling.test.ts exists

import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const CONTENT_MODELING_PATH = join(
	root,
	"packages/astropress/src/content-modeling.ts",
);
const PLATFORM_CONTRACTS_PATH = join(
	root,
	"packages/astropress/src/platform-contracts.ts",
);
const TEST_FILE_PATH = join(
	root,
	"packages/astropress/tests/content-modeling.test.ts",
);

const REQUIRED_FIELD_TYPES = [
	"text",
	"textarea",
	"number",
	"boolean",
	"date",
	"select",
	"content-ref",
	"repeater",
];

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const violations: string[] = [];

	// 1. content-modeling.ts exists and exports validateContentFields
	const contentModelingExists = await fileExists(CONTENT_MODELING_PATH);
	const contentModelingRel = relative(root, CONTENT_MODELING_PATH);

	if (!contentModelingExists) {
		violations.push(`[missing-file] ${contentModelingRel} does not exist`);
	} else {
		const src = await readFile(CONTENT_MODELING_PATH, "utf8");
		if (
			!/export\s+(async\s+)?function\s+validateContentFields|export\s*\{\s*[^}]*\bvalidateContentFields\b/.test(
				src,
			)
		) {
			violations.push(
				`[missing-export] ${contentModelingRel} does not export validateContentFields`,
			);
		}
	}

	// 2. platform-contracts.ts contains ContentStoreRecord with metadata field
	const platformContractsExists = await fileExists(PLATFORM_CONTRACTS_PATH);
	const platformContractsRel = relative(root, PLATFORM_CONTRACTS_PATH);

	if (!platformContractsExists) {
		violations.push(`[missing-file] ${platformContractsRel} does not exist`);
	} else {
		const src = await readFile(PLATFORM_CONTRACTS_PATH, "utf8");
		if (!/ContentStoreRecord/.test(src)) {
			violations.push(
				`[missing-interface] ${platformContractsRel} does not contain ContentStoreRecord interface`,
			);
		}
		if (!/metadata/.test(src)) {
			violations.push(
				`[missing-field] ${platformContractsRel} does not contain a metadata field on ContentStoreRecord`,
			);
		}
	}

	// 3. content-modeling.ts references all required field types
	if (contentModelingExists) {
		const src = await readFile(CONTENT_MODELING_PATH, "utf8");
		for (const fieldType of REQUIRED_FIELD_TYPES) {
			if (!src.includes(fieldType)) {
				violations.push(
					`[missing-field-type] ${contentModelingRel} does not reference field type "${fieldType}"`,
				);
			}
		}
	}

	// 4. Test file exists
	const testFileExists = await fileExists(TEST_FILE_PATH);
	const testFileRel = relative(root, TEST_FILE_PATH);

	if (!testFileExists) {
		violations.push(`[missing-test] ${testFileRel} does not exist`);
	}

	if (violations.length > 0) {
		console.error(
			`content-modeling audit failed — ${violations.length} issue(s):\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: ensure content-modeling.ts exports validateContentFields, platform-contracts.ts " +
				"defines ContentStoreRecord with metadata, all field types are supported, and tests exist.",
		);
		process.exit(1);
	}

	console.log(
		"content-modeling audit passed — content modeling subsystem verified.",
	);
}

main().catch((err) => {
	console.error("content-modeling audit failed:", err);
	process.exit(1);
});
