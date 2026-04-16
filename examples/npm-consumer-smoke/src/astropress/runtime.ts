import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";

import { createAstropressSqliteAdminRuntime } from "@astropress-diy/astropress/sqlite-admin-runtime";
import { createAstropressSqliteSeedToolkit, readAstropressSqliteSchemaSql } from "@astropress-diy/astropress/sqlite-bootstrap";
import type { RedirectRuleSeed, SeededComment } from "@astropress-diy/astropress/sqlite-bootstrap";

const configuredDataDirectory = process.env.ASTROPRESS_DATA_ROOT?.trim();
const dataDirectory = configuredDataDirectory || fileURLToPath(new URL("../../.data/", import.meta.url));
const dbPath = process.env.ADMIN_DB_PATH?.trim() || join(dataDirectory, "npm-consumer-smoke.sqlite");

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
        name: "Admin Smoke",
      },
      {
        email: "editor@example.com",
        password: "password",
        role: "editor" as const,
        name: "Editor Smoke",
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
    siteTitle: "Astropress Consumer Smoke",
    siteTagline: "Publish-time route verification harness",
    donationUrl: "https://example.com/donate",
    newsletterEnabled: false,
    commentsDefaultPolicy: "open-moderated",
  },
});

// workspaceRoot is not used by the seed toolkit when ASTROPRESS_DATA_ROOT is set.
// Provide a stable fallback so the runtime doesn't require monorepo context.
const runtimeRoot = fileURLToPath(new URL("../../", import.meta.url));

seedToolkit.seedDatabase({
  dbPath,
  reset: true,
  workspaceRoot: runtimeRoot,
});

const database = new DatabaseSync(dbPath);
const runtime = createAstropressSqliteAdminRuntime({
  getDatabase: () => database,
});

export const sqliteAdminStore = runtime.sqliteAdminStore;
export const sqliteCmsRegistryModule = runtime.sqliteCmsRegistryModule;
export const authenticatePersistedAdminUser = runtime.authenticatePersistedAdminUser;
