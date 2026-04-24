import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";
import {
	attemptRepair,
	runIntegrityCheck,
	runIntegrityCheckOnOpenDatabase,
} from "../src/sqlite-integrity";

let testRoot: string;

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-integrity-"));
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
});

async function seedHealthyDb(dbPath: string) {
	const DbClass = await loadSqliteDatabase();
	const db = new DbClass(dbPath);
	db.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)");
	db.prepare("INSERT INTO widgets (name) VALUES (?)").run("alpha");
	db.prepare("INSERT INTO widgets (name) VALUES (?)").run("beta");
	db.close();
}

describe("runIntegrityCheck", () => {
	it("reports ok for a freshly seeded database", async () => {
		const dbPath = join(testRoot, "healthy.sqlite");
		await seedHealthyDb(dbPath);
		const result = await runIntegrityCheck(dbPath, { mode: "quick" });
		expect(result.status).toBe("ok");
		expect(result.messages).toEqual(["ok"]);
	});

	it("reports unavailable for a non-sqlite file", async () => {
		const bogus = join(testRoot, "not-a-db.sqlite");
		writeFileSync(bogus, "this is definitely not a sqlite file");
		const result = await runIntegrityCheck(bogus, { mode: "quick" });
		expect(result.status).toBe("unavailable");
	});

	it("supports full integrity_check mode", async () => {
		const dbPath = join(testRoot, "full.sqlite");
		await seedHealthyDb(dbPath);
		const result = await runIntegrityCheck(dbPath, { mode: "full" });
		expect(result.status).toBe("ok");
		expect(result.mode).toBe("full");
	});
});

describe("runIntegrityCheckOnOpenDatabase", () => {
	it("works with an in-memory database", async () => {
		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(":memory:");
		db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
		const result = runIntegrityCheckOnOpenDatabase(db);
		expect(result.status).toBe("ok");
		db.close();
	});
});

describe("attemptRepair", () => {
	it("performs a dump-replay repair roundtrip on a healthy database", async () => {
		const dbPath = join(testRoot, "recover.sqlite");
		await seedHealthyDb(dbPath);

		const result = await attemptRepair(dbPath);
		expect(result.repaired).toBe(true);

		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(dbPath);
		const rows = db
			.prepare("SELECT name FROM widgets ORDER BY id")
			.all() as Array<{
			name: string;
		}>;
		expect(rows.map((r) => r.name)).toEqual(["alpha", "beta"]);
		db.close();
	});

	it("reports failure when the source file is not a sqlite database", async () => {
		const bogus = join(testRoot, "garbage.sqlite");
		writeFileSync(bogus, "not a database");
		const result = await attemptRepair(bogus);
		expect(result.repaired).toBe(false);
	});
});
