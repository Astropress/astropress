import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Prefer .ts over .js for extensionless imports so v8 coverage tracks
		// TypeScript source files during tests. The package.json `default`
		// condition points at the built `dist/` files, which we don't want
		// vitest to resolve — these aliases short-circuit that.
		extensionAlias: {
			".js": [".ts", ".js"],
		},
		alias: [
			// Exact-match only so subpath imports like "@astropress-diy/astropress/api-middleware.js" fall through
			// to the alias rules below (required for page-handler test imports).
			{
				find: /^@astropress-diy\/astropress$/,
				replacement: fileURLToPath(new URL("./index.ts", import.meta.url)),
			},
			// Explicit aliases for subpaths used by pages/ap-api/v1/* handlers
			{
				find: /^@astropress-diy\/astropress\/local-runtime-modules(?:\.js)?$/,
				replacement: fileURLToPath(new URL("./src/local-runtime-modules.ts", import.meta.url)),
			},
			{
				find: /^@astropress-diy\/astropress\/api-middleware(?:\.js)?$/,
				replacement: fileURLToPath(new URL("./src/api-middleware.ts", import.meta.url)),
			},
			{
				find: /^@astropress-diy\/astropress\/platform-contracts(?:\.js)?$/,
				replacement: fileURLToPath(new URL("./src/platform-contracts.ts", import.meta.url)),
			},
			{
				find: /^@astropress-diy\/astropress\/import\/wordpress(?:\.js)?$/,
				replacement: fileURLToPath(new URL("./src/import/wordpress.ts", import.meta.url)),
			},
			{
				find: "cloudflare:workers",
				replacement: fileURLToPath(new URL("./src/cloudflare-workers-stub.ts", import.meta.url)),
			},
		],
	},
	test: {
		setupFiles: ["tests/setup/html-rewriter-polyfill.ts"],
		include: ["tests/**/*.test.ts"],
		testTimeout: 20000,
		hookTimeout: 60000,
		unstubGlobals: true,
		// Default isolation kept on (no pool/maxWorkers/isolate overrides) so
		// vi.mock works correctly per file. The previous coverage-mode hack
		// (pool: forks, maxWorkers: 1, isolate: false) shared module state
		// across files and silently broke ~5 tests that mock
		// ../src/local-runtime-modules with different shapes — first import
		// won, subsequent vi.mock calls were no-ops.
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			reportsDirectory: "./coverage",
			// Broadened from a hand-picked 23-file allowlist to the full src
			// tree. The previous narrow include hid 242 baseline-tracked files
			// from v8 entirely; the discovery audit flagged this as "false
			// confidence" — mutation passing on a file v8 never executed.
			// audit-v8-coverage-scope now gates that no baseline file goes
			// unmeasured. Per-file ratcheting lives in a follow-up coverage
			// floor script, mirroring the mutation baseline pattern.
			include: ["src/**/*.ts"],
			exclude: [
				"src/cloudflare-*-stub.*",
				"src/client/**/*.ts",
				"src/local-runtime-modules.ts",
				"src/**/*.d.ts",
				"dist/**",
			],
			// Thresholds intentionally omitted at this stage — the broadened
			// include drops aggregate percentages well below the previous 95s.
			// audit-v8-coverage-scope enforces the include ratchet; per-file
			// thresholds will land alongside the coverage-floor script.
		},
	},
});
