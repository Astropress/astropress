// Root-level vitest config so `bun vitest` from the repo root doesn't sweep
// tooling/e2e/*.spec.ts (Playwright suites authored against
// `@playwright/test`, not vitest — they fail with "describe is not a
// function" if vitest tries to run them) or pull `packages/*/tests/` files
// without their package-specific aliases/setup loaded.
//
// `projects` delegates to each package's own vitest.config.ts so
// resolve.alias and globalSetup hooks remain authoritative. Canonical test
// runs still go via `bun run --filter @astropress-diy/astropress test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"./packages/astropress/vitest.config.ts",
			"./packages/astropress-nexus/vitest.config.ts",
			"./examples/github-pages/vitest.config.ts",
		],
	},
});
