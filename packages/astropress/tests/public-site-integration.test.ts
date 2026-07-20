import { existsSync } from "node:fs";
import path from "node:path";
import { createAstropressPublicSiteIntegration } from "@astropress-diy/astropress";
import { describe, expect, it, vi } from "vitest";
import { injectAstropressAdminRoutes, listAstropressAdminRoutes } from "../src/admin-routes";
import {
	createAstropressSitemapIntegration,
	createAstropressPublicSiteIntegration as createPublicSiteDirect,
} from "../src/public-site-integration";

describe("createAstropressPublicSiteIntegration", () => {
	it("returns a valid AstroIntegration with the correct name", () => {
		const integration = createAstropressPublicSiteIntegration();
		expect(integration.name).toBe("astropress-public-site");
	});

	it("has an astro:config:setup hook", () => {
		const integration = createAstropressPublicSiteIntegration();
		expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
	});

	it("accepts buildHookSecret without error", () => {
		expect(() =>
			createAstropressPublicSiteIntegration({ buildHookSecret: "abc123" }),
		).not.toThrow();
	});

	it("does not inject any ap-admin routes when hook is called", () => {
		const integration = createAstropressPublicSiteIntegration();
		const injectedPatterns: string[] = [];

		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");

		// Call the hook with a spy injectRoute — public site should never inject admin routes
		hook({
			_config: {},
			injectRoute: (route: { pattern: string }) => {
				injectedPatterns.push(route.pattern);
			},
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);

		// Public site may inject non-admin routes (sitemap, robots, llms.txt) but never ap-admin
		expect(injectedPatterns.some((p) => p.includes("ap-admin"))).toBe(false);
	});

	it("injects sitemap.xml, robots.txt, and llms.txt routes with their exact entrypoint paths", () => {
		const integration = createAstropressPublicSiteIntegration();
		const injected: Array<{ pattern: string; entrypoint: string }> = [];

		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");

		hook({
			_config: {},
			injectRoute: (route: { pattern: string; entrypoint: string }) => {
				injected.push({ pattern: route.pattern, entrypoint: route.entrypoint });
			},
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);

		const sitemap = injected.find((r) => r.pattern === "/sitemap.xml");
		const robots = injected.find((r) => r.pattern === "/robots.txt");
		const llms = injected.find((r) => r.pattern === "/llms.txt");
		expect(sitemap?.entrypoint).toMatch(/pages\/sitemap\.xml\.ts$/);
		expect(robots?.entrypoint).toMatch(/pages\/robots\.txt\.ts$/);
		expect(llms?.entrypoint).toMatch(/pages\/llms\.txt\.ts$/);
	});

	function collectInjectedPatterns(
		integration: ReturnType<typeof createAstropressPublicSiteIntegration>,
	): string[] {
		const patterns: string[] = [];
		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");
		hook({
			_config: {},
			injectRoute: (route: { pattern: string }) => patterns.push(route.pattern),
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);
		return patterns;
	}

	it("always injects the public page renderer at /[...slug] with its entrypoint", () => {
		const injected: Array<{ pattern: string; entrypoint: string }> = [];
		const hook = createAstropressPublicSiteIntegration().hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");
		hook({
			_config: {},
			injectRoute: (route: { pattern: string; entrypoint: string }) => injected.push(route),
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);
		const slug = injected.find((r) => r.pattern === "/[...slug]");
		expect(slug).toBeDefined();
		expect(slug?.entrypoint).toMatch(/pages\/astropress-public-page\.astro$/);
	});

	// #198: the /[...slug] entrypoint is command-conditional. `astro dev` gets an
	// on-demand (prerender=false) sibling so pages published while the dev server
	// runs render immediately; build/preview keep the prerendered page.
	function injectedSlugEntrypoint(command?: "dev" | "build" | "preview"): string | undefined {
		const injected: Array<{ pattern: string; entrypoint: string }> = [];
		const hook = createPublicSiteDirect().hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");
		hook({
			_config: {},
			command,
			injectRoute: (route: { pattern: string; entrypoint: string }) => injected.push(route),
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);
		return injected.find((r) => r.pattern === "/[...slug]")?.entrypoint;
	}

	it("injects the on-demand dev entrypoint at /[...slug] in `astro dev` (#198)", () => {
		expect(injectedSlugEntrypoint("dev")).toMatch(/pages\/astropress-public-page-dev\.astro$/);
	});

	it("injects the prerendered entrypoint at /[...slug] for build and preview", () => {
		expect(injectedSlugEntrypoint("build")).toMatch(/pages\/astropress-public-page\.astro$/);
		expect(injectedSlugEntrypoint("preview")).toMatch(/pages\/astropress-public-page\.astro$/);
	});

	it("the on-demand dev entrypoint resolves to a real file on disk", () => {
		const devEntry = injectedSlugEntrypoint("dev");
		expect(typeof devEntry).toBe("string");
		expect(existsSync(devEntry as string)).toBe(true);
	});

	// Imports the factory directly from the source module (not the barrel) so
	// Stryker reliably associates these assertions with the file's mutants.
	it("resolves route entrypoints to real paths and applies the shared vite config", () => {
		const injected: Array<{ pattern: string; entrypoint: string }> = [];
		let viteConfig: { vite?: { resolve?: unknown; ssr?: unknown; server?: unknown } } | undefined;
		const hook = createPublicSiteDirect().hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");
		hook({
			_config: {},
			injectRoute: (route: { pattern: string; entrypoint: string }) => injected.push(route),
			addMiddleware: vi.fn(),
			updateConfig: (cfg: { vite?: Record<string, unknown> }) => {
				viteConfig = cfg;
			},
		} as never);

		// packageResource must resolve to a real string path, not undefined.
		const slug = injected.find((r) => r.pattern === "/[...slug]");
		expect(typeof slug?.entrypoint).toBe("string");
		expect(slug?.entrypoint.endsWith("pages/astropress-public-page.astro")).toBe(true);

		// updateConfig must receive the shared host vite config (alias + ssr + fs).
		expect(viteConfig?.vite).toBeDefined();
		expect(viteConfig?.vite?.resolve).toBeDefined();
		expect(viteConfig?.vite?.ssr).toBeDefined();
		expect(viteConfig?.vite?.server).toBeDefined();
	});

	// #181: registering the public renderer defines a flag the admin reads to
	// know a same-origin "Open page" preview will actually resolve here.
	it("defines ASTROPRESS_PUBLIC_RENDERER_PRESENT so the admin can trust same-origin previews", () => {
		let viteConfig: { vite?: { define?: Record<string, unknown> } } | undefined;
		const hook = createPublicSiteDirect().hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");
		hook({
			_config: {},
			injectRoute: vi.fn(),
			addMiddleware: vi.fn(),
			updateConfig: (cfg: { vite?: Record<string, unknown> }) => {
				viteConfig = cfg;
			},
		} as never);

		expect(viteConfig?.vite?.define).toMatchObject({
			"import.meta.env.ASTROPRESS_PUBLIC_RENDERER_PRESENT": "true",
		});
	});

	it("injects only the renderer (no support routes) when includeSupportRoutes is false", () => {
		// Used in the dev config alongside the admin integration, which already
		// injects sitemap/robots/llms — this avoids a duplicate-route collision.
		const patterns = collectInjectedPatterns(
			createAstropressPublicSiteIntegration({ includeSupportRoutes: false }),
		);
		expect(patterns).toContain("/[...slug]");
		expect(patterns).not.toContain("/sitemap.xml");
		expect(patterns).not.toContain("/robots.txt");
		expect(patterns).not.toContain("/llms.txt");
	});

	it("does not register any admin middleware when hook is called", () => {
		const integration = createAstropressPublicSiteIntegration();
		const addMiddleware = vi.fn();

		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");

		hook({ _config: {}, injectRoute: vi.fn(), addMiddleware, updateConfig: vi.fn() } as never);

		expect(addMiddleware).not.toHaveBeenCalled();
	});

	it("public integration injects no admin routes while admin routes are non-empty", () => {
		const publicIntegration = createAstropressPublicSiteIntegration();
		const publicInjected: string[] = [];

		const hook = publicIntegration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");

		hook({
			_config: {},
			injectRoute: (route: { pattern: string }) => {
				publicInjected.push(route.pattern);
			},
			addMiddleware: vi.fn(),
			updateConfig: vi.fn(),
		} as never);

		const adminRoutes = listAstropressAdminRoutes();

		// Public site integration injects public utility routes (sitemap, robots, llms.txt) but never admin routes
		expect(publicInjected.some((p) => p.includes("ap-admin"))).toBe(false);
		expect(adminRoutes.length).toBeGreaterThan(0);
		expect(adminRoutes.every((r) => r.pattern.startsWith("/ap-admin"))).toBe(true);
	});

	it("injectAstropressAdminRoutes injects all admin routes with correct patterns", () => {
		const injected: Array<{ pattern: string; entrypoint: string }> = [];
		injectAstropressAdminRoutes("/pages/ap-admin", (route) => injected.push(route));

		expect(injected.length).toBeGreaterThan(0);
		expect(injected.every((r) => r.pattern.startsWith("/ap-admin"))).toBe(true);
		expect(injected.every((r) => r.entrypoint.startsWith("/pages/ap-admin/"))).toBe(true);
	});
});

describe("createAstropressSitemapIntegration", () => {
	it("returns an integration with name 'astropress-sitemap'", () => {
		const integration = createAstropressSitemapIntegration();
		expect(integration.name).toBe("astropress-sitemap");
	});

	it("injects sitemap.xml and og-image routes with their exact entrypoint paths", () => {
		const injected: Array<{ pattern: string; entrypoint: string }> = [];
		const integration = createAstropressSitemapIntegration({
			siteUrl: "https://example.com",
		});
		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook");
		hook({
			injectRoute: (route: { pattern: string; entrypoint: string }) =>
				injected.push({ pattern: route.pattern, entrypoint: route.entrypoint }),
			updateConfig: vi.fn(),
		} as never);

		const sitemap = injected.find((r) => r.pattern === "/sitemap.xml");
		const ogImage = injected.find((r) => r.pattern === "/ap-api/v1/og-image/[slug].svg");
		expect(sitemap?.entrypoint).toMatch(/pages\/sitemap\.xml\.ts$/);
		expect(ogImage?.entrypoint).toMatch(/pages\/ap-api\/v1\/og-image\/\[slug\]\.svg\.ts$/);
	});

	it("calls updateConfig with the JSON-stringified siteUrl define when options.siteUrl is set (peekCmsConfig unused)", () => {
		const updateConfig = vi.fn();
		const integration = createAstropressSitemapIntegration({
			siteUrl: "https://from-options.test",
		});
		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook");
		hook({ injectRoute: vi.fn(), updateConfig } as never);

		expect(updateConfig).toHaveBeenCalledTimes(1);
		expect(updateConfig).toHaveBeenCalledWith({
			vite: {
				define: {
					"import.meta.env.ASTROPRESS_SITE_URL": JSON.stringify("https://from-options.test"),
				},
			},
		});
	});

	it("falls back to peekCmsConfig().siteUrl when options.siteUrl is omitted", async () => {
		const { registerCms } = await import("../src/config");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://from-cms-config.test",
			seedPages: [],
			archives: [],
			translationStatus: [],
		});
		const updateConfig = vi.fn();
		const integration = createAstropressSitemapIntegration();
		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook");
		hook({ injectRoute: vi.fn(), updateConfig } as never);

		expect(updateConfig).toHaveBeenCalledTimes(1);
		expect(updateConfig).toHaveBeenCalledWith({
			vite: {
				define: {
					"import.meta.env.ASTROPRESS_SITE_URL": JSON.stringify("https://from-cms-config.test"),
				},
			},
		});
	});

	it("does NOT call updateConfig when both options.siteUrl and peekCmsConfig().siteUrl are absent", () => {
		// Reset the config store so peekCmsConfig() returns null.
		const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
		delete (globalThis as Record<symbol, unknown>)[CMS_CONFIG_KEY];

		const updateConfig = vi.fn();
		const integration = createAstropressSitemapIntegration();
		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook");
		hook({ injectRoute: vi.fn(), updateConfig } as never);

		expect(updateConfig).not.toHaveBeenCalled();
	});
});

describe("OG image endpoint (ap-api/v1/og-image/[slug].svg.ts)", () => {
	const ogEndpointPath = path.resolve(
		import.meta.dirname,
		"../pages/ap-api/v1/og-image/[slug].svg.ts",
	);

	it("endpoint file exists", () => {
		expect(existsSync(ogEndpointPath)).toBe(true);
	});

	it("endpoint exports a GET handler and prerender=false", async () => {
		const source = (await import("../pages/ap-api/v1/og-image/[slug].svg.ts?raw"))
			.default as string;
		expect(source).toContain("export const GET");
		expect(source).toContain("prerender = false");
	});

	it("endpoint returns SVG with correct Content-Type", async () => {
		const { GET } = await import("../pages/ap-api/v1/og-image/[slug].svg.ts");
		const request = new Request(
			"https://example.com/ap-api/v1/og-image/my-post.svg?title=Hello+World&site=My+Site",
		);
		const response = (await GET({
			request,
			params: { slug: "my-post" },
		})) as Response;
		expect(response.headers.get("content-type")).toContain("svg");
		const body = await response.text();
		expect(body).toContain("Hello World");
		expect(body).toContain("My Site");
	});
});

describe("AstropressSeoHead OG image fallback", () => {
	it("AstropressSeoHead.astro falls back to generated OG image when ogImage is not set", () => {
		const seoHeadPath = path.resolve(import.meta.dirname, "../components/AstropressSeoHead.astro");
		const source = existsSync(seoHeadPath)
			? require("node:fs").readFileSync(seoHeadPath, "utf8")
			: "";
		expect(source).toContain("ap-api/v1/og-image");
		expect(source).toContain("ogImageFallbackParams");
	});
});
