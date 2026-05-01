import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { createIntegrationsRepository } from "../src/sqlite-runtime/integrations";

/**
 * Privacy invariant: a sqlite dump of the live database must never
 * contain integration plaintext. Ciphertext is fine; raw API keys
 * are the bug. Mirrors design doc §4.4.
 *
 * Uses an on-disk database (rather than `:memory:`) so we can VACUUM
 * INTO a sibling file and grep its bytes for the canary.
 */

const ROOT = "test-root-current";
const NOW = "2026-05-02T12:00:00.000Z";
const CANARY = "PLAINTEXT-CANARY-DUMP-Q4F7";

let tmp: string;
let dbPath: string;
let db: DatabaseSync;

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "astropress-secret-dump-"));
	dbPath = join(tmp, "test.db");
	db = new DatabaseSync(dbPath);
	db.exec(readAstropressSqliteSchemaSql());
	db.exec("PRAGMA foreign_keys = ON");
});

afterEach(() => {
	try {
		db.close();
	} catch {
		// already closed
	}
	rmSync(tmp, { recursive: true, force: true });
});

describe("integration_secrets sqlite-dump privacy", () => {
	it("plaintext canary never appears in a VACUUM INTO of the database", async () => {
		const repo = createIntegrationsRepository({
			getDb: () => db as never,
			now: () => NOW,
		});
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: '{"baseUrl":"https://example.test"}',
				secretFields: { apiKey: CANARY },
				now: NOW,
			},
			ROOT,
		);

		const dumpPath = join(tmp, "dump.db");
		db.exec(`VACUUM INTO '${dumpPath.replace(/'/g, "''")}'`);

		const bytes = readFileSync(dumpPath);
		const text = bytes.toString("binary");
		expect(text).not.toContain(CANARY);
	});

	it("plaintext canary stays absent after disconnect", async () => {
		const repo = createIntegrationsRepository({
			getDb: () => db as never,
			now: () => NOW,
		});
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: CANARY },
				now: NOW,
			},
			ROOT,
		);
		expect(repo.disconnect("newsletter", "listmonk")).toBe(true);

		const dumpPath = join(tmp, "dump-after-disconnect.db");
		db.exec(`VACUUM INTO '${dumpPath.replace(/'/g, "''")}'`);
		const bytes = readFileSync(dumpPath);
		expect(bytes.toString("binary")).not.toContain(CANARY);
	});
});
