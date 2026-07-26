import { describe, expect, it } from "vitest";
import { buildPreviewLoginRedirect, resolvePreviewPath } from "../src/admin-preview-middleware";

describe("resolvePreviewPath", () => {
	it("returns the slug for a valid preview path", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/blog/my-draft-post");
		const result = resolvePreviewPath(url);
		expect(result).toEqual({ slug: "blog/my-draft-post" });
	});

	it("returns the slug for a simple single-segment preview path", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/coming-soon");
		const result = resolvePreviewPath(url);
		expect(result).toEqual({ slug: "coming-soon" });
	});

	it("returns null for a non-preview admin path", () => {
		const url = new URL("http://admin.example.com/ap-admin/posts");
		const result = resolvePreviewPath(url);
		expect(result).toBeNull();
	});

	it("returns null for the root admin path", () => {
		const url = new URL("http://admin.example.com/ap-admin");
		const result = resolvePreviewPath(url);
		expect(result).toBeNull();
	});

	it("returns null for a public path", () => {
		const url = new URL("http://admin.example.com/blog/my-post");
		const result = resolvePreviewPath(url);
		expect(result).toBeNull();
	});

	it("handles deeply nested slugs", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/2024/01/15/my-post-title");
		const result = resolvePreviewPath(url);
		expect(result).toEqual({ slug: "2024/01/15/my-post-title" });
	});

	it("returns null when /ap-admin/preview/ appears mid-path (kills ^-removal mutant)", () => {
		// Without the ^ anchor the regex would match anywhere in pathname,
		// e.g. an attacker-crafted path like /foo/ap-admin/preview/bar.
		const url = new URL("http://admin.example.com/decoy/ap-admin/preview/secret");
		expect(resolvePreviewPath(url)).toBeNull();
	});

	it("returns null for the bare /ap-admin/preview/ path (no slug)", () => {
		// Empty slug must be rejected — only matches when there is at
		// least one character after the trailing slash (the (.+) quantifier).
		const url = new URL("http://admin.example.com/ap-admin/preview/");
		expect(resolvePreviewPath(url)).toBeNull();
	});
});

describe("buildPreviewLoginRedirect", () => {
	it("builds a login redirect with the return path encoded", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/coming-soon");
		const redirect = buildPreviewLoginRedirect(url);
		expect(redirect).toBe("/ap-admin/login?return=%2Fap-admin%2Fpreview%2Fcoming-soon");
	});

	it("preserves query parameters in the return path", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/post?draft=1");
		const redirect = buildPreviewLoginRedirect(url);
		expect(redirect).toContain("/ap-admin/login?return=");
		expect(redirect).toContain("draft");
	});

	it("returns a path starting with /ap-admin/login", () => {
		const url = new URL("http://admin.example.com/ap-admin/preview/test");
		const redirect = buildPreviewLoginRedirect(url);
		expect(redirect.startsWith("/ap-admin/login")).toBe(true);
	});
});

describe("preview route isolation from production build", () => {
	it("preview routes exist only in the admin route list", async () => {
		const { listAstropressAdminRoutes } = await import("../src/admin-routes");
		const routes = listAstropressAdminRoutes();

		const previewRoutes = routes.filter((r) => r.pattern.includes("preview"));
		expect(previewRoutes.length).toBeGreaterThan(0);
		expect(previewRoutes.every((r) => r.pattern.startsWith("/ap-admin/"))).toBe(true);
	});

	it("createAstropressPublicSiteIntegration injects zero preview routes", async () => {
		const { createAstropressPublicSiteIntegration } = await import(
			"../src/public-site-integration"
		);
		const integration = createAstropressPublicSiteIntegration();
		const injected: string[] = [];

		const hook = integration.hooks["astro:config:setup"];
		if (typeof hook !== "function") throw new Error("Expected hook");

		hook({
			_config: {},
			injectRoute: (route: { pattern: string }) => {
				injected.push(route.pattern);
			},
			addMiddleware: () => {},
			updateConfig: () => {},
		} as never);

		expect(injected.filter((p) => p.includes("preview"))).toHaveLength(0);
		expect(injected.filter((p) => p.includes("ap-admin"))).toHaveLength(0);
	});
});
