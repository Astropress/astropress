// Rubric 23 (Content Modeling Flexibility)
//
// Static analysis audit that verifies the content modeling subsystem:
//
//   1. content-modeling.ts exists and exports validateContentFields
//   2. platform-contracts.ts contains ContentStoreRecord with a metadata field
//   3. content-modeling.ts references all required field types
//   4. content-modeling.test.ts exists

import { relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const CONTENT_MODELING_PATH = fromRoot(
	"packages/astropress/src/content-modeling.ts",
);
const PLATFORM_CONTRACTS_PATH = fromRoot(
	"packages/astropress/src/platform-contracts.ts",
);
const TEST_FILE_PATH = fromRoot(
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

async function main() {
	const report = new AuditReport("content-modeling");

	// 1. content-modeling.ts exists and exports validateContentFields
	const contentModelingExists = await fileExists(CONTENT_MODELING_PATH);
	const contentModelingRel = relative(ROOT, CONTENT_MODELING_PATH);

	if (!contentModelingExists) {
		report.add(`[missing-file] ${contentModelingRel} does not exist`);
	} else {
		const src = await readText(CONTENT_MODELING_PATH);
		if (
			!/export\s+(async\s+)?function\s+validateContentFields|export\s*\{\s*[^}]*\bvalidateContentFields\b/.test(
				src,
			)
		) {
			report.add(
				`[missing-export] ${contentModelingRel} does not export validateContentFields`,
			);
		}
	}

	// 2. platform-contracts.ts contains ContentStoreRecord with metadata field
	const platformContractsExists = await fileExists(PLATFORM_CONTRACTS_PATH);
	const platformContractsRel = relative(ROOT, PLATFORM_CONTRACTS_PATH);

	if (!platformContractsExists) {
		report.add(`[missing-file] ${platformContractsRel} does not exist`);
	} else {
		const src = await readText(PLATFORM_CONTRACTS_PATH);
		if (!/ContentStoreRecord/.test(src)) {
			report.add(
				`[missing-interface] ${platformContractsRel} does not contain ContentStoreRecord interface`,
			);
		}
		if (!/metadata/.test(src)) {
			report.add(
				`[missing-field] ${platformContractsRel} does not contain a metadata field on ContentStoreRecord`,
			);
		}
	}

	// 3. content-modeling.ts references all required field types
	if (contentModelingExists) {
		const src = await readText(CONTENT_MODELING_PATH);
		for (const fieldType of REQUIRED_FIELD_TYPES) {
			if (!src.includes(fieldType)) {
				report.add(
					`[missing-field-type] ${contentModelingRel} does not reference field type "${fieldType}"`,
				);
			}
		}
	}

	// 4. Test file exists
	const testFileExists = await fileExists(TEST_FILE_PATH);
	const testFileRel = relative(ROOT, TEST_FILE_PATH);

	if (!testFileExists) {
		report.add(`[missing-test] ${testFileRel} does not exist`);
	}

	if (report.failed) {
		console.error(
			"\nFix: ensure content-modeling.ts exports validateContentFields, platform-contracts.ts " +
				"defines ContentStoreRecord with metadata, all field types are supported, and tests exist.",
		);
	}

	report.finish(
		"content-modeling audit passed — content modeling subsystem verified.",
	);
}

runAudit("content-modeling", main);
