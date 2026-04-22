import type { DatabaseSync } from "node:sqlite";
import { SqliteBackedD1Database } from "./provider-test-fixtures.js";

/**
 * Creates a minimal App.Locals mock backed by an in-memory SQLite database.
 *
 * The `as unknown as App.Locals` cast is intentional: App.Locals is inferred
 * from Astro's runtime and cannot be constructed without the full Astro env.
 * All tests that need a D1-backed locals object should use this helper rather
 * than duplicating the cast inline.
 */
export function makeLocals(db: DatabaseSync): App.Locals {
	return {
		runtime: { env: { DB: new SqliteBackedD1Database(db) } },
	} as unknown as App.Locals;
}
