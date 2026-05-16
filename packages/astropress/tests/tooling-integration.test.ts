import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createAstropressAdminAppIntegration } from "../src/admin-app-integration";
import {
	ASTROPRESS_ADMIN_BASE_PATH,
	createAstropressAdminRouteInjectionPlan,
	injectAstropressAdminRoutes,
	listAstropressAdminRoutes,
} from "../src/admin-routes";
import { defineAstropressHostRuntimeModules } from "../src/host-runtime-modules";
import { createAstropressViteIntegration } from "../src/vite-integration";
import { createAstropressLocalRuntimeModulePlugin } from "../src/vite-runtime-alias";
import { createAstropressVitestLocalRuntimePlugins } from "../src/vitest-runtime-alias";
import { findRepoRoot } from "./_helpers/repo-root";

const pagesDirectory = path.resolve(import.meta.dirname, "../pages/ap-admin");

describe("tooling integration", () => {
	it("ships page files for the canonical admin route inventory and injects them through the Astro integration", () => {
		const routeEntrypoints = createAstropressAdminRouteInjectionPlan(pagesDirectory);
		const injectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];
		const integration = createAstropressAdminAppIntegration();

		for (const route of routeEntrypoints) {
			expect(
				existsSync(route.entrypoint),
				`missing file for ${route.pattern}: ${route.entrypoint}`,
			).toBe(true);
		}

		integration.hooks["astro:config:setup"]({
			injectRoute(route) {
				injectedRoutes.push(route);
			},
			addMiddleware: () => {},
		} as never);
		const callbackInjectedRoutes: Array<{
			pattern: string;
			entrypoint: string;
		}> = [];

		expect(ASTROPRESS_ADMIN_BASE_PATH).toBe("/ap-admin");
		expect(listAstropressAdminRoutes()).toHaveLength(routeEntrypoints.length);
		// The integration injects admin routes plus additional system routes (health, sitemap, robots, llms, metrics, og-image).
		// Filter to only the admin routes before comparing against the plan.
		const adminInjectedRoutes = injectedRoutes.filter((r) => r.pattern.startsWith("/ap-admin"));
		expect(adminInjectedRoutes).toEqual(routeEntrypoints);
		expect(
			injectAstropressAdminRoutes(pagesDirectory, (route) => callbackInjectedRoutes.push(route)),
		).toEqual(routeEntrypoints);
		expect(callbackInjectedRoutes).toEqual(routeEntrypoints);
	});

	it("injects every ADMIN_APP_INJECTED_ROUTES entry (health, sitemap, robots, llms, metrics, og-image)", async () => {
		// Kills the L60-62 BlockStatement mutant (for-loop body removed). Without
		// these routes the integration would only inject /ap-admin routes, breaking
		// /ap/health, /sitemap.xml, /robots.txt, /llms.txt and the API endpoints.
		const integration = createAstropressAdminAppIntegration();
		const injectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];
		integration.hooks["astro:config:setup"]?.({
			injectRoute(route: { pattern: string; entrypoint: string }) {
				injectedRoutes.push(route);
			},
			addMiddleware: () => {},
		} as never);
		const patterns = injectedRoutes.map((r) => r.pattern);
		expect(patterns).toContain("/ap/health");
		expect(patterns).toContain("/sitemap.xml");
		expect(patterns).toContain("/robots.txt");
		expect(patterns).toContain("/llms.txt");
		expect(patterns).toContain("/ap-api/v1/metrics");
		expect(patterns).toContain("/ap-api/v1/og-image/[slug].png");
	});

	it("injects plugin-declared admin routes from peekCmsConfig().plugins[].adminRoutes", async () => {
		// Kills the L66 ConditionalExpression `if (false)` mutant — without the
		// guard mutation the plugin admin route only appears when config.plugins is
		// truthy and the inner loop runs.
		const { registerCms } = await import("../src/config");
		registerCms({
			...((await import("./helpers/make-db")).STANDARD_CMS_CONFIG as never),
			plugins: [
				// Plugin WITHOUT adminRoutes — the inner `if (plugin.adminRoutes)`
				// guard is the only thing keeping a `for (const route of undefined)`
				// TypeError at bay. Mutating that guard to `if (true)` would crash
				// here; `if (false)` would never inject the next plugin's routes.
				{ name: "no-admin-routes-plugin" } as never,
				{
					name: "test-plugin-admin-routes",
					adminRoutes: [
						{
							pattern: "/ap-admin/test-plugin",
							entrypoint: "/abs/path/test-plugin-entry.js",
						},
					],
				} as never,
			],
		} as never);

		const integration = createAstropressAdminAppIntegration();
		const injectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];
		integration.hooks["astro:config:setup"]?.({
			injectRoute(route: { pattern: string; entrypoint: string }) {
				injectedRoutes.push(route);
			},
			addMiddleware: () => {},
		} as never);
		const pluginRoute = injectedRoutes.find((r) => r.pattern === "/ap-admin/test-plugin");
		expect(pluginRoute).toBeDefined();
		expect(pluginRoute?.entrypoint).toBe("/abs/path/test-plugin-entry.js");
	});

	it("registers security middleware via addMiddleware in astro:config:setup", () => {
		const integration = createAstropressAdminAppIntegration();
		const registered: unknown[] = [];
		integration.hooks["astro:config:setup"]?.({
			injectRoute: () => {},
			addMiddleware: (m) => registered.push(m),
		} as never);
		expect(registered).toHaveLength(1);
		expect(registered[0]).toMatchObject({ order: "pre" });
	});

	it("exposes Vite, Vitest, and host runtime helpers from one coherent boundary", async () => {
		const localRuntimeModulesPath = "/tmp/site/src/astropress/local-runtime-modules.ts";
		const vite = createAstropressViteIntegration({
			localRuntimeModulesPath,
			cloudflareWorkersStubPath: "/tmp/site/src/astropress/cloudflare-workers-stub.ts",
		});
		const [replacePlugin, rewritePlugin] =
			createAstropressVitestLocalRuntimePlugins(localRuntimeModulesPath);
		const runtimePlugin = createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath);
		const hostRuntimeModules = defineAstropressHostRuntimeModules({
			async loadLocalAdminStore() {
				return {} as never;
			},
			async loadLocalAdminAuth() {
				return {} as never;
			},
			async loadLocalCmsRegistry() {
				return {} as never;
			},
			async loadLocalMediaStorage() {
				return {} as never;
			},
			async loadLocalImageStorage() {
				return {} as never;
			},
		});

		expect(vite.plugins[0]?.name).toBe("astropress-local-runtime-modules");
		expect(vite.aliases).toHaveLength(3);
		expect(replacePlugin.name).toBe("astropress-local-runtime-modules-replacer");
		expect(rewritePlugin.name).toBe("astropress-external-source-rewriter");
		expect(runtimePlugin.resolveId("./local-runtime-modules")).toBe(localRuntimeModulesPath);
		await expect(hostRuntimeModules.loadLocalAdminAuth()).resolves.toEqual({});
	});

	it("admin-harness astro config declares ssr.noExternal for @astropress-diy/astropress", () => {
		// Regression guard for the SSR-externalization bug fixed in ci/audit-scripts-and-workflow-hardening.
		//
		// When output:"server" is set, Vite SSR-externalizes workspace packages by
		// default, which means the astropress-local-runtime-modules Vite plugin is
		// never called for imports inside the package. As a result,
		// `./local-runtime-modules` in admin-store-dispatch.ts resolves to the dist
		// stub that throws `unavailable()`, breaking all admin CRUD form submissions.
		//
		// The fix is ssr.noExternal:["@astropress-diy/astropress"] in the harness
		// Vite config. This test prevents accidental removal.
		const configPath = path.join(findRepoRoot(), "examples/admin-harness/astro.config.mjs");
		const source = readFileSync(configPath, "utf8");
		expect(
			source,
			"examples/admin-harness/astro.config.mjs must declare ssr.noExternal for @astropress-diy/astropress " +
				"so the Vite plugin pipeline intercepts ./local-runtime-modules imports inside the package. " +
				"Without this, admin CRUD form submissions silently fail with 'Local runtime modules are only available…'.",
		).toMatch(/noExternal[^}]*@astropress-diy\/astropress/s);
	});

	it("loads the emitted runtime js entrypoints cleanly", async () => {
		const runtimeEntryPoints = [
			"../src/platform-contracts.js",
			"../src/project-env.js",
			"../src/project-runtime.js",
			"../src/project-launch.js",
			"../src/provider-choice.js",
			"../src/admin-routes.js",
			"../src/admin-ui.js",
			"../src/config.js",
			"../src/hosted-api-adapter.js",
			"../src/d1-admin-store.js",
			"../src/hosted-platform-adapter.js",
			"../src/sqlite-bootstrap.js",
			"../src/sqlite-admin-runtime.js",
			"../src/adapters/sqlite.js",
			"../src/adapters/hosted.js",
			"../src/adapters/cloudflare.js",
			"../src/adapters/supabase.js",
			"../src/adapters/supabase-sqlite.js",
			"../src/adapters/local.js",
			"../src/adapters/project.js",
			"../src/admin-app-integration.js",
			"../src/integration.js",
			"../src/cloudflare-vite-integration.js",
			"../src/deploy/github-pages.js",
			"../src/deploy/cloudflare-pages.js",
			"../src/deploy/vercel.js",
			"../src/deploy/netlify.js",
			"../src/deploy/render.js",
			"../src/deploy/gitlab-pages.js",
			"../src/deploy/custom.js",
			"../src/content-services-ops.js",
			"../src/db-migrate-ops.js",
			"../src/import/wordpress.js",
			"../src/sync/git.js",
			"../src/newsletter-adapter.js",
			"../src/api-middleware.js",
		] as const;

		for (const entryPoint of runtimeEntryPoints) {
			const module = await import(
				pathToFileURL(new URL(entryPoint, import.meta.url).pathname).href
			);
			expect(module).toBeTruthy();
		}
	});
});
