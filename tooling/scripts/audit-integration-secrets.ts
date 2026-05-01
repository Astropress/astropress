/**
 * Integration Secrets Audit
 *
 * Enforces the leak-prevention rules from
 * tooling/docs/phase-2-secret-store-design.md §4.1:
 *
 *   1. Direct reads of `integration_secrets.ciphertext` / `dek_wrap`
 *      may only appear in the envelope module, the repository, and
 *      the rotation script. Any other file referencing these column
 *      names is suspect.
 *   2. The envelope module must NOT import any logger, fetch, DB, or
 *      console-using helper — pure crypto.
 *   3. Every write to `connected_integrations.last_error` must route
 *      through `sanitizeIntegrationError` (defense in depth — bare
 *      string updates may leak upstream API bodies).
 *   4. The sealed-secret JSON shape must contain exactly the seven
 *      documented keys. A stray `provider` / `apiKey` / `plaintext`
 *      key would mean somebody added a debug field that ships to
 *      disk.
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	ROOT,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const SRC_DIR = fromRoot("packages/astropress/src");
const TESTS_DIR = fromRoot("packages/astropress/tests");
const TOOLING_DIR = fromRoot("tooling/scripts");

const ENVELOPE_FILE = "packages/astropress/src/integration-secret-envelope.ts";
const REPO_FILE = "packages/astropress/src/sqlite-runtime/integrations.ts";
const SANITIZER_FILE = "packages/astropress/src/integration-error-sanitizer.ts";
const ROTATION_SCRIPT = "tooling/scripts/rotate-integration-secrets.ts";

const ALLOWED_SECRET_COLUMN_FILES: ReadonlySet<string> = new Set([
	ENVELOPE_FILE,
	REPO_FILE,
	ROTATION_SCRIPT,
	"packages/astropress/src/sqlite-schema.sql",
]);

const SECRET_COLUMN_TOKENS = ["ciphertext", "dek_wrap", "wrap_salt", "wrap_iv"];
const ENVELOPE_FORBIDDEN_IMPORTS = [
	"./logger",
	"./logging",
	"console",
	"fetch(",
	"node:fs",
	"node:http",
	"node:https",
	"./sqlite-runtime",
	"better-sqlite3",
];

const SEALED_SECRET_KEYS = [
	"v",
	"kid",
	"wrap_salt",
	"wrap_iv",
	"dek_wrap",
	"data_iv",
	"ciphertext",
];

async function readRel(rel: string): Promise<string> {
	return readText(join(ROOT, rel));
}

async function main() {
	const report = new AuditReport("integration-secrets");

	// Rule 1: column-name leaks outside the allowlist.
	const tsFiles = (
		await Promise.all([
			listFiles(SRC_DIR, { recursive: true, extensions: [".ts"] }).then((rs) =>
				rs.map((r) => `packages/astropress/src/${r}`),
			),
			listFiles(TESTS_DIR, { recursive: true, extensions: [".ts"] }).then(
				(rs) => rs.map((r) => `packages/astropress/tests/${r}`),
			),
			listFiles(TOOLING_DIR, { recursive: true, extensions: [".ts"] }).then(
				(rs) => rs.map((r) => `tooling/scripts/${r}`),
			),
		])
	).flat();
	for (const rel of tsFiles) {
		if (ALLOWED_SECRET_COLUMN_FILES.has(rel)) continue;
		// Test files may reference the columns to assert privacy invariants;
		// the test directory is exempt to allow that surface.
		if (rel.startsWith("packages/astropress/tests/")) continue;
		// Audit scripts may name columns when reasoning about them.
		if (rel === "tooling/scripts/audit-integration-secrets.ts") continue;
		const src = await readRel(rel);
		for (const token of SECRET_COLUMN_TOKENS) {
			// Allow the token to appear inside an import path or as part of
			// another identifier; only flag exact column references that look
			// like SQL or JSON access.
			const sqlPattern = new RegExp(
				`(SELECT[^;]*\\b${token}\\b|\\b${token}\\s*[:,])`,
			);
			if (sqlPattern.test(src)) {
				report.add(
					`[secret-column-leak] ${rel}: references "${token}" outside the envelope/repository/rotation allowlist. Read secrets only via createIntegrationsRepository.findSecret().`,
				);
				break;
			}
		}
	}

	// Rule 2: envelope module purity.
	{
		const src = await readRel(ENVELOPE_FILE);
		for (const forbidden of ENVELOPE_FORBIDDEN_IMPORTS) {
			if (src.includes(forbidden)) {
				report.add(
					`[envelope-impurity] ${ENVELOPE_FILE} contains forbidden token "${forbidden}". The envelope must remain a pure-crypto module — no logging, no I/O.`,
				);
			}
		}
	}

	// Rule 3: last_error sanitisation. Repository updateStatus accepts an
	// arbitrary string, but every CALLER (action handlers) must pass a
	// value that came through sanitizeIntegrationError, not a raw err.message.
	const nonSanitizedLastError = /last_error[^\n]*=\s*[`'"][^`'"]/i;
	for (const rel of tsFiles) {
		// Skip the schema.sql path — it's not in tsFiles, but be defensive.
		if (
			rel === REPO_FILE ||
			rel === SANITIZER_FILE ||
			rel === "tooling/scripts/audit-integration-secrets.ts" ||
			rel.startsWith("packages/astropress/tests/")
		) {
			continue;
		}
		const src = await readRel(rel);
		if (
			src.includes("last_error") &&
			!src.includes("sanitizeIntegrationError") &&
			nonSanitizedLastError.test(src)
		) {
			report.add(
				`[last-error-bypass] ${relative(ROOT, join(ROOT, rel))}: writes to last_error without importing sanitizeIntegrationError. Route every error code through src/integration-error-sanitizer.ts.`,
			);
		}
	}

	// Rule 4: envelope JSON shape regression-guard. Walk the envelope
	// module source and confirm the SealedSecret interface declares
	// exactly the seven documented fields.
	{
		const src = await readRel(ENVELOPE_FILE);
		const ifaceMatch = src.match(/interface SealedSecret\s*\{([^}]+)\}/);
		if (!ifaceMatch) {
			report.add(
				`[envelope-shape] ${ENVELOPE_FILE}: SealedSecret interface not found.`,
			);
		} else {
			const body = ifaceMatch[1];
			const declared = new Set<string>();
			for (const line of body.split("\n")) {
				const m = line.match(/readonly\s+(\w+)\s*[:?]/);
				if (m) declared.add(m[1]);
			}
			const expected = new Set(SEALED_SECRET_KEYS);
			for (const k of declared) {
				if (!expected.has(k)) {
					report.add(
						`[envelope-shape] SealedSecret has unexpected field "${k}". A new field would ship to disk on every record — confirm intent and update this audit.`,
					);
				}
			}
			for (const k of expected) {
				if (!declared.has(k)) {
					report.add(
						`[envelope-shape] SealedSecret is missing required field "${k}".`,
					);
				}
			}
		}
	}

	report.finish(
		`integration-secrets audit passed — ${tsFiles.length} files scanned, no plaintext leak surfaces.`,
	);
}

runAudit("integration-secrets", main);
