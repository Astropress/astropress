import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyArgon2idPassword } from "../src/crypto-primitives";
import {
	createAstropressSqliteSeedToolkit,
	createDefaultAstropressSqliteSeedToolkit,
} from "../src/sqlite-bootstrap";
import { makeDb } from "./helpers/make-db.js";

let tmpDir: string;
let tmpDbPath: string;

beforeEach(() => {
	tmpDir = path.join(
		tmpdir(),
		`astropress-bootstrap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(tmpDir, { recursive: true });
	tmpDbPath = path.join(tmpDir, "admin.sqlite");
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// createDefaultAstropressSqliteSeedToolkit — default seed values
// ---------------------------------------------------------------------------

describe("createDefaultAstropressSqliteSeedToolkit — default seed users", () => {
	// Two argon2id verifications run back-to-back here. Under v8 coverage
	// instrumentation the per-verify cost roughly triples, so the default
	// 30s vitest timeout can fire on a loaded prepush worker. 60s gives the
	// crypto path headroom without hiding a regression.
	it("seeds the documented admin@example.com / editor@example.com bootstrap users with roles 'admin' and 'editor' and names 'Admin' / 'Editor', each with a non-empty password hash", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = makeDb();
		toolkit.seedDatabase({ db, dbPath: ":memory:" });

		const users = db
			.prepare("SELECT email, name, is_admin, password_hash FROM admin_users ORDER BY email")
			.all() as Array<{
			email: string;
			name: string;
			is_admin: number;
			password_hash: string;
		}>;

		const admin = users.find((u) => u.email === "admin@example.com");
		const editor = users.find((u) => u.email === "editor@example.com");
		expect(admin).toBeDefined();
		expect(admin?.name).toBe("Admin");
		expect(admin?.is_admin).toBe(1);
		expect(verifyArgon2idPassword("password", admin?.password_hash ?? "")).toBe(true);

		expect(editor).toBeDefined();
		expect(editor?.name).toBe("Editor");
		expect(editor?.is_admin).toBe(0);
		expect(verifyArgon2idPassword("password", editor?.password_hash ?? "")).toBe(true);
	}, 60_000);
});

describe("createDefaultAstropressSqliteSeedToolkit — default site settings", () => {
	it("seeds siteTitle='Astropress', siteTagline='Low-carbon publishing', donationUrl='https://example.com/donate', newsletterEnabled=false", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = makeDb();
		toolkit.seedDatabase({ db, dbPath: ":memory:" });

		const row = db
			.prepare(
				"SELECT site_title, site_tagline, donation_url, newsletter_enabled FROM site_settings WHERE id = 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(row).toBeDefined();
		expect(row?.site_title).toBe("Astropress");
		expect(row?.site_tagline).toBe("Low-carbon publishing");
		expect(row?.donation_url).toBe("https://example.com/donate");
		expect(row?.newsletter_enabled).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// seedDatabase — connection ownership semantics (ownsConnection branch)
// ---------------------------------------------------------------------------

describe("seedDatabase — ownsConnection semantics", () => {
	it("does NOT close the provided db (ownsConnection=false): the caller's db remains usable after seedDatabase returns", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = makeDb();
		toolkit.seedDatabase({ db, dbPath: ":memory:" });
		// If db were closed, this query would throw.
		const count = db.prepare("SELECT COUNT(*) AS n FROM admin_users").get() as { n: number };
		expect(count.n).toBeGreaterThan(0);
	});

	it("creates the parent directory and the database file when no db is provided (ownsConnection=true)", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const nestedPath = path.join(tmpDir, "deep", "nested", "admin.sqlite");
		expect(existsSync(path.dirname(nestedPath))).toBe(false);
		toolkit.seedDatabase({ dbPath: nestedPath });
		expect(existsSync(path.dirname(nestedPath))).toBe(true);
		expect(existsSync(nestedPath)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// seedDatabase — reset behaviour (reset=true vs file path)
// ---------------------------------------------------------------------------

describe("seedDatabase — reset", () => {
	it("removes an existing file when reset=true: an extra row written between seedings does not survive the reset", async () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		toolkit.seedDatabase({ dbPath: tmpDbPath });
		expect(existsSync(tmpDbPath)).toBe(true);

		// Write a marker row to the existing DB so we can detect a reset.
		const { DatabaseSync } = await import("node:sqlite");
		const probe = new DatabaseSync(tmpDbPath);
		probe.prepare("CREATE TABLE marker_table (n INTEGER)").run();
		probe.prepare("INSERT INTO marker_table (n) VALUES (42)").run();
		probe.close();

		toolkit.seedDatabase({ dbPath: tmpDbPath, reset: true });
		expect(existsSync(tmpDbPath)).toBe(true);

		const verify = new DatabaseSync(tmpDbPath);
		try {
			const row = verify
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marker_table'")
				.get();
			expect(row).toBeUndefined();
		} finally {
			verify.close();
		}
	});

	it("preserves an existing file (no reset side-effect) when reset is omitted: a marker row added between seedings is preserved", async () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		toolkit.seedDatabase({ dbPath: tmpDbPath });

		const { DatabaseSync } = await import("node:sqlite");
		const probe = new DatabaseSync(tmpDbPath);
		probe.prepare("CREATE TABLE marker_keep (n INTEGER)").run();
		probe.close();

		toolkit.seedDatabase({ dbPath: tmpDbPath });

		const verify = new DatabaseSync(tmpDbPath);
		try {
			const row = verify
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marker_keep'")
				.get() as { name: string } | undefined;
			expect(row?.name).toBe("marker_keep");
		} finally {
			verify.close();
		}
	});

	it("does NOT call rmSync when dbPath is ':memory:' even with reset=true (no filesystem side effect)", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = makeDb();
		// If rmSync were attempted on :memory:, it would throw ENOENT (no such path)
		// and the call would surface as a test failure. The :memory: guard avoids this.
		expect(() => toolkit.seedDatabase({ db, dbPath: ":memory:", reset: true })).not.toThrow();
	});

	it("passes { force: true } to rmSync so reset=true on a non-existent dbPath does NOT throw ENOENT", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const absentPath = path.join(tmpDir, "never-existed.sqlite");
		expect(existsSync(absentPath)).toBe(false);
		// With { force: true }, rmSync silently no-ops on a missing path. Without
		// it (e.g. {} or { force: false }), rmSync throws ENOENT.
		expect(() => toolkit.seedDatabase({ dbPath: absentPath, reset: true })).not.toThrow();
		expect(existsSync(absentPath)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// seedDatabase — workspaceRoot resolution (LogicalOperator ??)
// ---------------------------------------------------------------------------

describe("seedDatabase — workspaceRoot", () => {
	it("uses an explicit workspaceRoot to derive the default dbPath when dbPath is omitted", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const workspaceRoot = path.join(tmpDir, "explicit-workspace");
		mkdirSync(workspaceRoot, { recursive: true });

		toolkit.seedDatabase({ workspaceRoot });

		const expected = path.join(workspaceRoot, ".data", "admin.sqlite");
		expect(existsSync(expected)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// seedDatabase — error wrapping (catch block in seedDatabase)
// ---------------------------------------------------------------------------

describe("seedDatabase — error wrapping", () => {
	it("wraps a downstream seeder error with the documented 'Database seeding failed:' prefix", () => {
		const toolkit = createAstropressSqliteSeedToolkit({
			readSchemaSql: () => {
				throw new Error("schema-load-fail");
			},
			loadBootstrapUsers: () => [],
			loadMediaSeeds: () => [],
			redirectRules: [],
			comments: [],
			systemRoutes: [],
			archiveRoutes: [],
			marketingRoutes: [],
			siteSettings: {
				siteTitle: "T",
				siteTagline: "G",
				donationUrl: "",
				newsletterEnabled: false,
				commentsDefaultPolicy: "open-moderated",
			},
		});
		const db = makeDb();
		expect(() => toolkit.seedDatabase({ db, dbPath: ":memory:" })).toThrow(
			/^Database seeding failed:/,
		);
	});
});

// ---------------------------------------------------------------------------
// getDefaultAdminDbPath — workspaceRoot resolution
// ---------------------------------------------------------------------------

describe("getDefaultAdminDbPath", () => {
	it("returns '<workspaceRoot>/.data/admin.sqlite' when no override is provided", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		expect(toolkit.getDefaultAdminDbPath("/abs/workspace")).toBe(
			path.join("/abs/workspace", ".data", "admin.sqlite"),
		);
	});

	it("delegates to the user-provided getDefaultAdminDbPath option when supplied (?? short-circuits)", () => {
		const toolkit = createAstropressSqliteSeedToolkit({
			readSchemaSql: () => "",
			loadBootstrapUsers: () => [],
			loadMediaSeeds: () => [],
			redirectRules: [],
			comments: [],
			systemRoutes: [],
			archiveRoutes: [],
			marketingRoutes: [],
			siteSettings: {
				siteTitle: "T",
				siteTagline: "G",
				donationUrl: "",
				newsletterEnabled: false,
				commentsDefaultPolicy: "open-moderated",
			},
			getDefaultAdminDbPath: (root) => `${root}/custom-override.sqlite`,
		});
		expect(toolkit.getDefaultAdminDbPath("/abs/workspace")).toBe(
			"/abs/workspace/custom-override.sqlite",
		);
	});
});

// ---------------------------------------------------------------------------
// openSeedDatabase — :memory: vs file branches
// ---------------------------------------------------------------------------

describe("openSeedDatabase", () => {
	it("opens a :memory: database with foreign_keys ON (no journal_mode/synchronous pragmas applied)", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = toolkit.openSeedDatabase(":memory:");
		try {
			const fk = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
			expect(fk.foreign_keys).toBe(1);
			// :memory: journal_mode is always "memory" (cannot be set to WAL); the
			// :memory: guard means the WAL pragma never runs, but the result is
			// the same — confirming :memory: opens cleanly.
			const jm = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
			expect(jm.journal_mode).toBe("memory");
		} finally {
			db.close();
		}
	});

	it("applies WAL + NORMAL synchronous pragmas to a file-based database", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = toolkit.openSeedDatabase(tmpDbPath);
		try {
			const jm = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
			expect(jm.journal_mode).toBe("wal");
			const sync = db.prepare("PRAGMA synchronous").get() as { synchronous: number };
			// PRAGMA synchronous = NORMAL → 1
			expect(sync.synchronous).toBe(1);
		} finally {
			db.close();
		}
	});
});
