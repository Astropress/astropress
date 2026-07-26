import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
	type AstropressSqliteDatabaseLike,
	createAstropressSqliteAdminRuntime,
} from "@astropress-diy/astropress/sqlite-admin-runtime";
import { createDefaultAstropressSqliteSeedToolkit } from "@astropress-diy/astropress/sqlite-bootstrap";

const tempDataRoot = process.env.ASTROPRESS_DATA_ROOT?.trim();
const dbPath =
	process.env.ADMIN_DB_PATH ??
	(tempDataRoot ? join(tempDataRoot, "admin.sqlite") : ".data/admin.sqlite");
const dataDir = dbPath.substring(0, dbPath.lastIndexOf("/")) || ".data";

mkdirSync(dataDir, { recursive: true });

// Seed only when the database doesn't exist yet (first run). Re-seeding on every
// import is wasteful and, during a static `astro build`, runs this module in a
// bundled context where the schema file can't be resolved — so once the DB is
// present we simply read the authored content.
if (!existsSync(dbPath)) {
	const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
	seedToolkit.seedDatabase({ dbPath, workspaceRoot: process.cwd() });
}

const database = new DatabaseSync(dbPath);
const runtime = createAstropressSqliteAdminRuntime({
	// node:sqlite types `run().changes` as `number | bigint`; astropress narrows
	// it to `number` (bigint mode is never enabled), so cast at this boundary.
	getDatabase: () => database as unknown as AstropressSqliteDatabaseLike,
});

export const sqliteAdminStore = runtime.sqliteAdminStore;
export const sqliteCmsRegistryModule = runtime.sqliteCmsRegistryModule;
export const authenticatePersistedAdminUser =
	runtime.authenticatePersistedAdminUser;
