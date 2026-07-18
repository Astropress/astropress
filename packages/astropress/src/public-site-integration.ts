import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { peekCmsConfig } from "./config";

// Package-root resolution: when this module runs from `dist/src/`, walk up two
// levels; when it runs from `src/` (tests, dev without build), walk up one.
const packageRoot = (() => {
	const here = fileURLToPath(new URL(".", import.meta.url));
	const parent = dirname(here);
	return basename(parent) === "dist" ? dirname(parent) : parent;
})();

const packageResource = (relativePath: string) => join(packageRoot, relativePath);

export interface AstropressPublicSiteOptions {
	/**
	 * Optional secret token used to verify webhook-triggered rebuild requests.
	 * When set, an incoming POST to /_astropress/rebuild is authenticated against
	 * this value before triggering a new static build.
	 */
	buildHookSecret?: string;
	/**
	 * Whether to inject the public support routes (`/sitemap.xml`, `/robots.txt`,
	 * `/llms.txt`). Defaults to `true`. Set to `false` when composing this
	 * integration alongside `createAstropressAdminAppIntegration` (e.g. the dev
	 * server of a static-host project), which already injects those routes —
	 * avoiding a duplicate-route collision. The public page renderer is always
	 * injected.
	 */
	includeSupportRoutes?: boolean;
}

/**
 * Astro integration for the public production site.
 *
 * Unlike `createAstropressAdminAppIntegration`, this integration does NOT inject
 * any `/ap-admin/*` routes or admin middleware. It is designed for use in a
 * purely static Astro build so that the production domain has zero admin surface.
 *
 * @example
 * ```ts
 * // astro.config.mjs (public site project)
 * import { createAstropressPublicSiteIntegration } from "@astropress-diy/astropress";
 *
 * export default defineConfig({
 *   integrations: [createAstropressPublicSiteIntegration()],
 * });
 * ```
 */
export function createAstropressPublicSiteIntegration(
	options: AstropressPublicSiteOptions = {},
): AstroIntegration {
	const includeSupportRoutes = options.includeSupportRoutes ?? true;
	return {
		name: "astropress-public-site",
		hooks: {
			// No admin routes are injected.
			// No admin middleware is registered.
			// The host site registers its own content loaders and public routes.
			"astro:config:setup": ({ injectRoute, updateConfig }) => {
				// Provide the Vite settings the injected public renderer needs so a
				// scaffolded static build works without hand-editing astro.config
				// (the renderer imports the package + reads its bundled sections.css).
				// Matches createAstropressAdminAppIntegration so both dev and build
				// resolve the package the same way.
				updateConfig({
					vite: {
						// The injected renderer self-imports by the bare name `astropress`;
						// map it to the scoped package so no host alias is required.
						resolve: {
							alias: [
								{ find: /^astropress\/(.*)$/, replacement: "@astropress-diy/astropress/$1" },
								{ find: /^astropress$/, replacement: "@astropress-diy/astropress" },
							],
						},
						ssr: { noExternal: ["@astropress-diy/astropress", "astropress"] },
						server: { fs: { allow: [packageRoot] } },
					},
				});
				// buildHookSecret is reserved for future webhook rebuild support.
				// Public renderer for admin-authored structured pages. Injected as a
				// low-priority catch-all so specific host routes (e.g. src/pages/index.astro)
				// and the admin's /ap-admin/* routes still win.
				injectRoute({
					pattern: "/[...slug]",
					entrypoint: packageResource("pages/astropress-public-page.astro"),
				});
				if (includeSupportRoutes) {
					injectRoute({
						pattern: "/sitemap.xml",
						entrypoint: packageResource("pages/sitemap.xml.ts"),
					});
					injectRoute({
						pattern: "/robots.txt",
						entrypoint: packageResource("pages/robots.txt.ts"),
					});
					injectRoute({
						pattern: "/llms.txt",
						entrypoint: packageResource("pages/llms.txt.ts"),
					});
				}
			},
		},
	};
}

export interface AstropressSitemapOptions {
	/**
	 * Canonical base URL used as `<loc>` prefix in the sitemap.
	 * Defaults to `getCmsConfig().siteUrl` if not provided.
	 */
	siteUrl?: string;
	/**
	 * Additional URL paths to include in the sitemap beyond the framework-generated ones.
	 * Each entry should be a root-relative path (e.g. "/about", "/contact").
	 */
	additionalPaths?: string[];
}

/**
 * createAstropressSitemapIntegration
 *
 * A thin Astro integration wrapper around the framework's built-in sitemap
 * page (`/sitemap.xml`). It ensures the sitemap is injected with the correct
 * canonical URL configuration.
 *
 * Use this when you prefer the named integration pattern (`integrations: [...]`)
 * rather than calling `createAstropressPublicSiteIntegration()` which injects
 * all public routes at once.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { createAstropressSitemapIntegration } from "@astropress-diy/astropress";
 *
 * export default defineConfig({
 *   integrations: [
 *     createAstropressSitemapIntegration({ siteUrl: "https://example.com" }),
 *   ],
 * });
 * ```
 */
export function createAstropressSitemapIntegration(
	options: AstropressSitemapOptions = {},
): AstroIntegration {
	return {
		name: "astropress-sitemap",
		hooks: {
			"astro:config:setup": ({ injectRoute, updateConfig }) => {
				const siteUrl = options.siteUrl ?? peekCmsConfig()?.siteUrl ?? "";

				injectRoute({
					pattern: "/sitemap.xml",
					entrypoint: packageResource("pages/sitemap.xml.ts"),
				});

				// Inject the OG image endpoint so social cards are available on public sites too
				injectRoute({
					pattern: "/ap-api/v1/og-image/[slug].svg",
					entrypoint: packageResource("pages/ap-api/v1/og-image/[slug].svg.ts"),
				});

				// Expose siteUrl to the page via Vite define so sitemap.xml can use it
				if (siteUrl) {
					updateConfig({
						vite: {
							define: {
								"import.meta.env.ASTROPRESS_SITE_URL": JSON.stringify(siteUrl),
							},
						},
					});
				}
			},
		},
	};
}
