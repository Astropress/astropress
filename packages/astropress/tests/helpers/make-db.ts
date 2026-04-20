import { DatabaseSync } from "node:sqlite";
import type { registerCms } from "../../src/config";
import { readAstropressSqliteSchemaSql } from "../../src/sqlite-bootstrap.js";

/** Creates a fresh in-memory SQLite database initialised with the Astropress schema. */
export function makeDb(): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	db.exec(readAstropressSqliteSchemaSql());
	return db;
}

/** Standard actor used across runtime action tests. */
export const STANDARD_ACTOR = {
	email: "admin@test.local",
	role: "admin" as const,
	name: "Test Admin",
};

/** Minimal registerCms config used across runtime action tests. */
export const STANDARD_CMS_CONFIG = {
	templateKeys: ["content"],
	siteUrl: "https://example.com",
	seedPages: [],
	archives: [],
	translationStatus: [],
} satisfies Parameters<typeof registerCms>[0];
