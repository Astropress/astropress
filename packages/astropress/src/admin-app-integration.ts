import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

import {
	ADMIN_APP_ASSET_PATHS,
	ADMIN_APP_DEV_SERVE_ROUTES,
	ADMIN_APP_INJECTED_ROUTES,
	ADMIN_APP_INTEGRATION_NAME,
	ADMIN_APP_PAGES_DIRECTORY,
	ADMIN_APP_SECURITY_MIDDLEWARE_ENTRYPOINT,
	ADMIN_APP_SESSION_MIDDLEWARE_ENTRYPOINT,
} from "./admin-app-integration-data";
import { injectAstropressAdminRoutes } from "./admin-routes";
import { peekCmsConfig } from "./config";
import { astropressHostViteConfig, resolvePackageRoot } from "./integration-host-config";

const packageRoot = resolvePackageRoot(import.meta.url);

const packageResource = (relativePath: string) => join(packageRoot, relativePath);

const assetSources: Record<keyof typeof ADMIN_APP_ASSET_PATHS, string> = {
	adminCss: packageResource(ADMIN_APP_ASSET_PATHS.adminCss),
	sectionsCss: packageResource(ADMIN_APP_ASSET_PATHS.sectionsCss),
};

export function createAstropressAdminAppIntegration(): AstroIntegration {
	return {
		name: ADMIN_APP_INTEGRATION_NAME,
		hooks: {
			// Serve admin.css and sections.css from the package public directory
			// during development. sections.css is loaded by the section-editor
			// live-preview iframe (see web-components/page-preview.ts).
			"astro:server:setup": ({ server }) => {
				for (const { url, asset } of ADMIN_APP_DEV_SERVE_ROUTES) {
					server.middlewares.use(url, (_req, res) => {
						res.setHeader("Content-Type", "text/css; charset=utf-8");
						res.setHeader("Cache-Control", "no-cache");
						createReadStream(assetSources[asset]).pipe(res);
					});
				}
			},
			// Copy stylesheets into the build output for production deployments.
			"astro:build:done": async ({ dir }) => {
				const outDir = fileURLToPath(dir);
				await mkdir(outDir, { recursive: true });
				for (const asset of Object.values(assetSources)) {
					await copyFile(asset, join(outDir, basename(asset)));
				}
			},
			"astro:config:setup": ({ injectRoute, addMiddleware, updateConfig }) => {
				// Vite settings so a scaffolded project resolves the package with zero
				// hand-editing. Shared with the public-site integration so the two
				// can't drift (the copy-paste that caused #185).
				updateConfig({ vite: astropressHostViteConfig(packageRoot) });
				const pagesDirectory = packageResource(ADMIN_APP_PAGES_DIRECTORY);
				injectAstropressAdminRoutes(pagesDirectory, injectRoute);
				for (const { pattern, entrypoint } of ADMIN_APP_INJECTED_ROUTES) {
					injectRoute({ pattern, entrypoint: packageResource(entrypoint) });
				}

				// Inject plugin-declared admin routes
				const config = peekCmsConfig();
				if (config?.plugins) {
					for (const plugin of config.plugins) {
						if (plugin.adminRoutes) {
							for (const route of plugin.adminRoutes) {
								injectRoute({
									pattern: route.pattern,
									entrypoint: route.entrypoint,
								});
							}
						}
					}
				}

				// Resolve the signed-in admin from the session cookie into
				// `locals.adminUser` before the security middleware and the page
				// guards run. Without this a host could log in yet 403 on every
				// admin page (the guards read `locals.adminUser`, which nothing
				// else populates outside the e2e harness).
				addMiddleware({
					order: "pre",
					entrypoint: new URL(ADMIN_APP_SESSION_MIDDLEWARE_ENTRYPOINT, import.meta.url),
				});
				addMiddleware({
					order: "pre",
					entrypoint: new URL(ADMIN_APP_SECURITY_MIDDLEWARE_ENTRYPOINT, import.meta.url),
				});
			},
		},
	};
}
