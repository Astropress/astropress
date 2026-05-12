import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkpointSqliteWal, loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";

let testRoot: string;

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-helpers-test-"));
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
});

describe("loadSqliteDatabase", () => {
	it("returns a constructor that can open an in-memory database", async () => {
		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(":memory:");
		db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
		db.prepare("INSERT INTO t VALUES (1)").run();
		const row = db.prepare("SELECT id FROM t").get() as { id: number };
		expect(row.id).toBe(1);
		db.close();
	});
});

describe("checkpointSqliteWal", () => {
	it("returns true and emits no warning for a real WAL-mode SQLite file", async () => {
		const DbClass = await loadSqliteDatabase();
		const dbPath = join(testRoot, "real.sqlite");

		// Create a real SQLite DB in WAL mode with some data
		const db = new DbClass(dbPath);
		db.prepare("PRAGMA journal_mode = WAL").get();
		db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)");
		db.prepare("INSERT INTO items VALUES (1, 'hello')").run();
		db.close();

		const warnings: string[] = [];
		const result = await checkpointSqliteWal(dbPath, (msg) => warnings.push(msg));

		expect(result).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it("returns false and warns when the file is not a valid SQLite database", async () => {
		const badPath = join(testRoot, "bad.sqlite");
		writeFileSync(badPath, "this is not sqlite", "utf8");

		const warnings: string[] = [];
		const result = await checkpointSqliteWal(badPath, (msg) => warnings.push(msg));

		expect(result).toBe(false);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("bad.sqlite");
	});

	it("returns false (not a rejection) when the driver constructor itself throws on an unopenable path", async () => {
		// Path under a non-existent directory makes node:sqlite throw inside
		// `new DatabaseSync(path)` synchronously, leaving `db` undefined inside
		// the checkpoint helper. The finally block must still resolve cleanly —
		// `db?.close()`'s optional chain is load-bearing here.
		const unopenablePath = join(testRoot, "no-such-dir", "db.sqlite");

		const warnings: string[] = [];
		await expect(checkpointSqliteWal(unopenablePath, (msg) => warnings.push(msg))).resolves.toBe(
			false,
		);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("WAL checkpoint failed");
	});
});
