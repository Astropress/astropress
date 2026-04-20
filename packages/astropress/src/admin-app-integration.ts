import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

import { injectAstropressAdminRoutes } from "./admin-routes";
import { peekCmsConfig } from "./config";

// Package-root resolution: when this module runs from `dist/src/`, walk up two
// levels; when it runs from `src/` (tests, dev without build), walk up one.
const packageRoot = (() => {
	const here = fileURLToPath(new URL(".", import.meta.url));
	const parent = dirname(here);
	return basename(parent) === "dist" ? dirname(parent) : parent;
})();

const packageResource = (relativePath: string) =>
	join(packageRoot, relativePath);

const adminCssSrc = packageResource("public/admin.css");

export function createAstropressAdminAppIntegration(): AstroIntegration {
	return {
		name: "astropress-admin-app",
		hooks: {
			// Serve admin.css from the package public directory during development.
			"astro:server:setup": ({ server }) => {
				server.middlewares.use("/admin.css", (_req, res) => {
					res.setHeader("Content-Type", "text/css; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					createReadStream(adminCssSrc).pipe(res);
				});
			},
			// Copy admin.css into the build output for production deployments.
			"astro:build:done": async ({ dir }) => {
				const dest = join(fileURLToPath(dir), "admin.css");
				await mkdir(fileURLToPath(dir), { recursive: true });
				await copyFile(adminCssSrc, dest);
			},
			"astro:config:setup": ({ injectRoute, addMiddleware }) => {
				const pagesDirectory = packageResource("pages/ap-admin");
				injectAstropressAdminRoutes(pagesDirectory, injectRoute);
				injectRoute({
					pattern: "/ap/health",
					entrypoint: packageResource("pages/ap/health.js"),
				});
				injectRoute({
					pattern: "/sitemap.xml",
					entrypoint: packageResource("pages/sitemap.xml.js"),
				});
				injectRoute({
					pattern: "/robots.txt",
					entrypoint: packageResource("pages/robots.txt.js"),
				});
				injectRoute({
					pattern: "/llms.txt",
					entrypoint: packageResource("pages/llms.txt.js"),
				});
				injectRoute({
					pattern: "/ap-api/v1/metrics",
					entrypoint: packageResource("pages/ap-api/v1/metrics.js"),
				});
				injectRoute({
					pattern: "/ap-api/v1/og-image/[slug].png",
					entrypoint: packageResource("pages/ap-api/v1/og-image/[slug].png.js"),
				});

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

				addMiddleware({
					order: "pre",
					entrypoint: new URL(
						"./security-middleware-entrypoint.js",
						import.meta.url,
					),
				});
			},
		},
	};
}
