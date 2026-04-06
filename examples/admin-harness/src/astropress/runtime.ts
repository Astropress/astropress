import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";

import { createAstropressSqliteAdminRuntime } from "astropress/sqlite-admin-runtime";
import { createAstropressSqliteSeedToolkit, readAstropressSqliteSchemaSql } from "astropress/sqlite-bootstrap";
import type { RedirectRuleSeed, SeededComment } from "astropress/sqlite-bootstrap";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
const dataDirectory = fileURLToPath(new URL("../../.data/", import.meta.url));
const dbPath = fileURLToPath(new URL("../../.data/admin-harness.sqlite", import.meta.url));

mkdirSync(dataDirectory, { recursive: true });

const redirectRules: RedirectRuleSeed[] = [
  {
    sourcePath: "/legacy-start",
    targetPath: "/hello-world",
    statusCode: 301,
  },
];

const comments: SeededComment[] = [
  {
    id: "comment-1",
    author: "Pat Reader",
    email: "reader@example.com",
    body: "This is ready for moderation.",
    route: "/blog/hello-world",
    status: "pending",
    policy: "open-moderated",
    submittedAt: "2026-01-01T00:00:00.000Z",
  },
];

const seedToolkit = createAstropressSqliteSeedToolkit({
  readSchemaSql: readAstropressSqliteSchemaSql,
  loadBootstrapUsers() {
    return [
      {
        email: "admin@example.com",
        password: "password",
        role: "admin" as const,
        name: "Admin Harness",
      },
      {
        email: "editor@example.com",
        password: "password",
        role: "editor" as const,
        name: "Editor Harness",
      },
    ];
  },
  loadMediaSeeds() {
    return [];
  },
  redirectRules,
  comments,
  systemRoutes: [],
  archiveRoutes: [],
  marketingRoutes: [],
  siteSettings: {
    siteTitle: "Astropress Admin Harness",
    siteTagline: "Seeded admin verification target",
    donationUrl: "https://example.com/donate",
    newsletterEnabled: false,
    commentsDefaultPolicy: "open-moderated",
  },
});

seedToolkit.seedDatabase({
  dbPath,
  reset: true,
  workspaceRoot,
});

const database = new DatabaseSync(dbPath);
const runtime = createAstropressSqliteAdminRuntime({
  getDatabase: () => database,
});

export const sqliteAdminStore = runtime.sqliteAdminStore;
export const sqliteCmsRegistryModule = runtime.sqliteCmsRegistryModule;
export const authenticatePersistedAdminUser = runtime.authenticatePersistedAdminUser;
