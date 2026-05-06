// Type-check-only Astro config for the framework's own pages/ + components/.
// Not shipped (excluded by package.json `files`); not used at runtime.
//
// Why: the framework ships pages/ that host apps mount via the integration,
// but `astro check` in any consuming project only inspects routes under that
// project's own src/. Without this config, the 45 framework pages compile
// only when a downstream consumer builds — and recent 404 regressions match
// that gap. Running `bun run --filter @astropress-diy/astropress check`
// type-checks them in-place.

import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	root,
	srcDir: ".",
	publicDir: "./public",
	outDir: "./.astro-check-out",
	output: "static",
	devToolbar: { enabled: false },
	vite: {
		resolve: {
			alias: [
				// Self-imports inside the framework's own pages/components reach
				// `astropress/...` paths. Resolve them to the local source so
				// astro-check doesn't fall back to the published dist/ build.
				{
					find: /^astropress\/components\/(.*)$/,
					replacement: `${root}components/$1`,
				},
				{ find: /^astropress$/, replacement: `${root}index.ts` },
				{
					find: /^@astropress-diy\/astropress$/,
					replacement: `${root}index.ts`,
				},
			],
		},
	},
});
