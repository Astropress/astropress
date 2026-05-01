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
const sectionsCssSrc = packageResource("public/sections.css");

export function createAstropressAdminAppIntegration(): AstroIntegration {
	return {
		name: "astropress-admin-app",
		hooks: {
			// Serve admin.css and sections.css from the package public directory
			// during development. sections.css is loaded by the section-editor
			// live-preview iframe (see web-components/page-preview.ts).
			"astro:server:setup": ({ server }) => {
				server.middlewares.use("/admin.css", (_req, res) => {
					res.setHeader("Content-Type", "text/css; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					createReadStream(adminCssSrc).pipe(res);
				});
				server.middlewares.use("/sections.css", (_req, res) => {
					res.setHeader("Content-Type", "text/css; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					createReadStream(sectionsCssSrc).pipe(res);
				});
			},
			// Copy stylesheets into the build output for production deployments.
			"astro:build:done": async ({ dir }) => {
				const outDir = fileURLToPath(dir);
				await mkdir(outDir, { recursive: true });
				await copyFile(adminCssSrc, join(outDir, "admin.css"));
				await copyFile(sectionsCssSrc, join(outDir, "sections.css"));
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
