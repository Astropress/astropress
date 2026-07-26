import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the package root from a module's `import.meta.url`, whether it runs
 * from `dist/src/` (published build → walk up two levels) or `src/` (tests and
 * dev without a build → walk up one). Kept as a pure function of the URL so the
 * dist-vs-src branch is unit-testable, rather than a module-load IIFE that can
 * only ever observe its own on-disk location.
 */
export function resolvePackageRoot(moduleUrl: string): string {
	const here = fileURLToPath(new URL(".", moduleUrl));
	const parent = dirname(here);
	return basename(parent) === "dist" ? dirname(parent) : parent;
}

/**
 * The Vite settings every Astropress host integration must apply so a scaffolded
 * project resolves the package with zero hand-editing. Shared by the admin-app
 * and public-site integrations so the two can't drift (the copy-paste that
 * caused #185):
 *  - `resolve.alias`: the package's injected pages/components self-import by the
 *    bare name `astropress`; map it (and its subpaths) to the scoped package
 *    that actually resolves via node_modules.
 *  - `ssr.noExternal`: force Vite to process the package through its plugin
 *    pipeline so the local-runtime-modules seam resolves to the host
 *    implementation instead of the dist stub that throws `unavailable()`.
 *  - `server.fs.allow`: let the dev server read the package's injected
 *    pages/assets when it lives outside the project root (linked/monorepo).
 */
export function astropressHostViteConfig(packageRoot: string) {
	return {
		resolve: {
			alias: [
				// `(.*)` already runs to end-of-string; no `$` needed.
				{ find: /^astropress\/(.*)/, replacement: "@astropress-diy/astropress/$1" },
				{ find: /^astropress$/, replacement: "@astropress-diy/astropress" },
			],
		},
		ssr: { noExternal: ["@astropress-diy/astropress", "astropress"] },
		server: { fs: { allow: [packageRoot] } },
	};
}
