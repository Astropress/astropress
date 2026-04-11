import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
    alias: [
      // Exact-match only so subpath imports like "astropress/api-middleware.js" fall through
      // to the package.json exports map (required for page-handler test imports).
      { find: /^astropress$/, replacement: fileURLToPath(new URL("./index.ts", import.meta.url)) },
      // Explicit aliases for subpaths used by pages/ap-api/v1/* handlers
      { find: /^astropress\/local-runtime-modules(?:\.js)?$/, replacement: fileURLToPath(new URL("./src/local-runtime-modules.ts", import.meta.url)) },
      { find: /^astropress\/api-middleware(?:\.js)?$/, replacement: fileURLToPath(new URL("./src/api-middleware.ts", import.meta.url)) },
      { find: /^astropress\/platform-contracts(?:\.js)?$/, replacement: fileURLToPath(new URL("./src/platform-contracts.ts", import.meta.url)) },
      { find: "cloudflare:workers", replacement: fileURLToPath(new URL("./src/cloudflare-workers-stub.ts", import.meta.url)) },
    ],
  },
  test: {
    setupFiles: ["tests/setup/html-rewriter-polyfill.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "./coverage",
      // Only include files that do NOT have a paired .js companion.
      // Files with .js companions are loaded as .js at runtime (v8 tracks the .js path)
      // so their .ts coverage would always be 0% — a false negative.
      // Modules covered here are the ones directly executed from .ts source.
      include: [
        "src/admin-action-utils.ts",
        "src/admin-normalizers.ts",
        "src/html-optimization.ts",
        "src/html-sanitization.ts",
        "src/locale-links.ts",
        "src/media.ts",
        "src/provider-targets.ts",
        "src/runtime-admin-actions.ts",
        "src/runtime-actions-content.ts",
        "src/runtime-actions-users.ts",
        "src/runtime-actions-media.ts",
        "src/runtime-actions-taxonomies.ts",
        "src/runtime-actions-misc.ts",
        "src/admin-page-models.ts",
        "src/runtime-route-registry.ts",
        "src/runtime-route-registry-system.ts",
        "src/runtime-route-registry-pages.ts",
        "src/runtime-route-registry-archives.ts",
        "src/admin-store-dispatch.ts",
        "src/analytics.ts",
        "src/api-routes.ts",
      ],
      exclude: [
        "src/cloudflare-*-stub.*",
        "src/client/**/*.ts",
        "src/local-runtime-modules.ts",
        "src/**/*.d.ts",
        // Exclude .js companion stubs — they are not the executed code; the .ts
        // source files are resolved via extensionAlias and tracked instead.
        "src/**/*.js",
        "web-components/**/*.js",
        "index.js",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95,
      },
    },
  },
});
