import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createAstropressSqliteAdminRuntime } from "@astropress-diy/astropress/sqlite-admin-runtime";
import { createDefaultAstropressSqliteSeedToolkit } from "@astropress-diy/astropress/sqlite-bootstrap";

const tempDataRoot = process.env.ASTROPRESS_DATA_ROOT?.trim();
const dbPath = process.env.ADMIN_DB_PATH ?? (tempDataRoot ? join(tempDataRoot, "admin.sqlite") : ".data/admin.sqlite");
const dataDir = dbPath.substring(0, dbPath.lastIndexOf("/")) || ".data";

mkdirSync(dataDir, { recursive: true });

// Create schema if it does not exist (no reset — preserves existing data).
const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
seedToolkit.seedDatabase({ dbPath, workspaceRoot: process.cwd() });

const database = new DatabaseSync(dbPath);
const runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => database });

export const sqliteAdminStore = runtime.sqliteAdminStore;
export const sqliteCmsRegistryModule = runtime.sqliteCmsRegistryModule;
export const authenticatePersistedAdminUser = runtime.authenticatePersistedAdminUser;
