import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCanonicalOrigin } from "../src/canonical-origin";
import * as configModule from "../src/config";
import { peekCmsConfig, registerCms } from "../src/config";

// Capture and restore whatever config the suite started with so we don't leak
// a registered config into sibling test files sharing the module singleton.
let savedConfig: ReturnType<typeof peekCmsConfig>;

function baseConfig(siteUrl: string) {
	return {
		siteName: "Test",
		siteUrl,
		locales: ["en"],
		defaultLocale: "en",
	} as unknown as Parameters<typeof registerCms>[0];
}

describe("resolveCanonicalOrigin (#124)", () => {
	beforeEach(() => {
		savedConfig = peekCmsConfig();
	});
	afterEach(() => {
		if (savedConfig) registerCms(savedConfig);
	});

	it("uses the configured siteUrl origin, ignoring the request host", () => {
		registerCms(baseConfig("https://canonical.example.com"));
		const origin = resolveCanonicalOrigin({
			url: "https://attacker-proxy.evil/sitemap.xml",
		});
		expect(origin).toBe("https://canonical.example.com");
	});

	it("strips path/query from a configured siteUrl down to the origin", () => {
		registerCms(baseConfig("https://canonical.example.com/base/path?x=1"));
		expect(resolveCanonicalOrigin({ url: "https://whatever.test/robots.txt" })).toBe(
			"https://canonical.example.com",
		);
	});

	it("falls back to the request origin when siteUrl is malformed", () => {
		registerCms(baseConfig("not a url"));
		expect(resolveCanonicalOrigin({ url: "https://request-host.test/llms.txt" })).toBe(
			"https://request-host.test",
		);
	});

	it("falls back to the request origin when siteUrl is empty", () => {
		registerCms(baseConfig(""));
		expect(resolveCanonicalOrigin({ url: "https://request-host.test/sitemap.xml" })).toBe(
			"https://request-host.test",
		);
	});

	it("falls back to the request origin when no CMS config is registered (peekCmsConfig() undefined)", () => {
		// The `?.` in `peekCmsConfig()?.siteUrl` matters here: with no config at
		// all, dropping the optional chain would throw on `.siteUrl`. The route
		// must still resolve to the request-derived origin in zero-config setups.
		const spy = vi.spyOn(configModule, "peekCmsConfig").mockReturnValue(undefined);
		try {
			expect(resolveCanonicalOrigin({ url: "https://request-host.test/robots.txt" })).toBe(
				"https://request-host.test",
			);
		} finally {
			spy.mockRestore();
		}
	});
});
