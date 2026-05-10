import { existsSync } from "node:fs";
import path from "node:path";
import { createAstropressPublicSiteIntegration } from "@astropress-diy/astropress";
import { describe, expect, it, vi } from "vitest";
import { injectAstropressAdminRoutes, listAstropressAdminRoutes } from "../src/admin-routes";
import { createAstropressSitemapIntegration } from "../src/public-site-integration";

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
		} as never);

		const sitemap = injected.find((r) => r.pattern === "/sitemap.xml");
		const robots = injected.find((r) => r.pattern === "/robots.txt");
		const llms = injected.find((r) => r.pattern === "/llms.txt");
		expect(sitemap?.entrypoint).toMatch(/pages\/sitemap\.xml\.js$/);
		expect(robots?.entrypoint).toMatch(/pages\/robots\.txt\.js$/);
		expect(llms?.entrypoint).toMatch(/pages\/llms\.txt\.js$/);
	});

	it("does not register any admin middleware when hook is called", () => {
		const integration = createAstropressPublicSiteIntegration();
		const addMiddleware = vi.fn();

		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook to be a function");

		hook({ _config: {}, injectRoute: vi.fn(), addMiddleware } as never);

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
		const ogImage = injected.find((r) => r.pattern === "/ap-api/v1/og-image/[slug].png");
		expect(sitemap?.entrypoint).toMatch(/pages\/sitemap\.xml\.js$/);
		expect(ogImage?.entrypoint).toMatch(/pages\/ap-api\/v1\/og-image\/\[slug\]\.png\.js$/);
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

describe("OG image endpoint (ap-api/v1/og-image/[slug].png.ts)", () => {
	const ogEndpointPath = path.resolve(
		import.meta.dirname,
		"../pages/ap-api/v1/og-image/[slug].png.ts",
	);

	it("endpoint file exists", () => {
		expect(existsSync(ogEndpointPath)).toBe(true);
	});

	it("endpoint exports a GET handler and prerender=false", async () => {
		const source = (await import("../pages/ap-api/v1/og-image/[slug].png.ts?raw"))
			.default as string;
		expect(source).toContain("export const GET");
		expect(source).toContain("prerender = false");
	});

	it("endpoint returns SVG with correct Content-Type", async () => {
		const { GET } = await import("../pages/ap-api/v1/og-image/[slug].png.ts");
		const request = new Request(
			"https://example.com/ap-api/v1/og-image/my-post.png?title=Hello+World&site=My+Site",
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
