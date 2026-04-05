import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const runtimeEntryPoints = [
  "../src/platform-contracts.js",
  "../src/project-env.js",
  "../src/project-runtime.js",
  "../src/admin-routes.js",
  "../src/config.js",
  "../src/d1-admin-store.js",
  "../src/hosted-platform-adapter.js",
  "../src/sqlite-bootstrap.js",
  "../src/sqlite-admin-runtime.js",
  "../src/adapters/sqlite.js",
  "../src/adapters/hosted.js",
  "../src/adapters/cloudflare.js",
  "../src/adapters/supabase.js",
  "../src/adapters/runway.js",
  "../src/adapters/supabase-sqlite.js",
  "../src/adapters/runway-sqlite.js",
  "../src/adapters/local.js",
  "../src/adapters/project.js",
  "../src/admin-app-integration.js",
  "../src/integration.js",
  "../src/cloudflare-vite-integration.js",
  "../src/deploy/github-pages.js",
  "../src/import/wordpress.js",
  "../src/sync/git.js",
] as const;

describe("runtime js entrypoints", () => {
  it("load cleanly through their emitted js files", async () => {
    for (const entryPoint of runtimeEntryPoints) {
      const module = await import(pathToFileURL(new URL(entryPoint, import.meta.url).pathname).href);
      expect(module).toBeTruthy();
    }
  });
});
