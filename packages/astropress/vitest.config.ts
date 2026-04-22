import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const isCoverageRun = process.argv.includes("--coverage");
const isSingleForkCoverageRun = isCoverageRun;

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
				replacement: fileURLToPath(
					new URL("./src/local-runtime-modules.ts", import.meta.url),
				),
			},
			{
				find: /^@astropress-diy\/astropress\/api-middleware(?:\.js)?$/,
				replacement: fileURLToPath(
					new URL("./src/api-middleware.ts", import.meta.url),
				),
			},
			{
				find: /^@astropress-diy\/astropress\/platform-contracts(?:\.js)?$/,
				replacement: fileURLToPath(
					new URL("./src/platform-contracts.ts", import.meta.url),
				),
			},
			{
				find: /^@astropress-diy\/astropress\/import\/wordpress(?:\.js)?$/,
				replacement: fileURLToPath(
					new URL("./src/import/wordpress.ts", import.meta.url),
				),
			},
			{
				find: "cloudflare:workers",
				replacement: fileURLToPath(
					new URL("./src/cloudflare-workers-stub.ts", import.meta.url),
				),
			},
		],
	},
	test: {
		setupFiles: ["tests/setup/html-rewriter-polyfill.ts"],
		include: ["tests/**/*.test.ts"],
		testTimeout: 20000,
		hookTimeout: 60000,
		unstubGlobals: true,
		pool: isSingleForkCoverageRun ? "forks" : undefined,
		maxWorkers: isSingleForkCoverageRun ? 1 : undefined,
		isolate: isSingleForkCoverageRun ? false : undefined,
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			reportsDirectory: "./coverage",
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
				"dist/**",
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
