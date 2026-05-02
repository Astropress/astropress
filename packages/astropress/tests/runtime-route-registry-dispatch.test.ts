import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalCmsRegistry: vi.fn(),
}));

import { registerCms } from "../src/config";
import { loadLocalCmsRegistry } from "../src/local-runtime-modules";
import {
	loadSafeLocalCmsRegistry,
	localeFromPath,
	parseSettings,
	withSafeRouteRegistryFallback,
} from "../src/runtime-route-registry-dispatch";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

afterEach(() => {
	(globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[
		CMS_CONFIG_KEY
	] = null;
	vi.restoreAllMocks();
});

describe("loadSafeLocalCmsRegistry", () => {
	it("returns the registry when load succeeds", async () => {
		(loadLocalCmsRegistry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			marker: "ok",
		});
		expect(await loadSafeLocalCmsRegistry()).toEqual({ marker: "ok" });
	});

	it("returns null when load throws", async () => {
		(loadLocalCmsRegistry as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("nope"),
		);
		expect(await loadSafeLocalCmsRegistry()).toBeNull();
	});
});

describe("withSafeRouteRegistryFallback", () => {
	it("returns the operation result on success (no fallback invoked)", async () => {
		const fallback = vi.fn();
		const result = await withSafeRouteRegistryFallback(
			fallback,
			"default",
			async () => "ok",
		);
		expect(result).toBe("ok");
		expect(fallback).not.toHaveBeenCalled();
	});

	it("invokes fallback with the local registry when operation throws and registry loads", async () => {
		(loadLocalCmsRegistry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			marker: "local",
		});
		const fallback = vi.fn(
			async (local: { marker: string }) => `fb-${local.marker}`,
		);
		const result = await withSafeRouteRegistryFallback(
			fallback,
			"default",
			async () => {
				throw new Error("boom");
			},
		);
		expect(result).toBe("fb-local");
		expect(fallback).toHaveBeenCalledWith({ marker: "local" });
	});

	it("returns defaultValue when operation throws AND registry load fails", async () => {
		(loadLocalCmsRegistry as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("registry-also-broken"),
		);
		const fallback = vi.fn();
		const result = await withSafeRouteRegistryFallback(
			fallback,
			"default-value",
			async () => {
				throw new Error("boom");
			},
		);
		expect(result).toBe("default-value");
		expect(fallback).not.toHaveBeenCalled();
	});

	it("returns defaultValue when operation throws AND registry load returns null/undefined", async () => {
		(loadLocalCmsRegistry as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			null,
		);
		const result = await withSafeRouteRegistryFallback(
			vi.fn(),
			"def",
			async () => {
				throw new Error("boom");
			},
		);
		expect(result).toBe("def");
	});
});

describe("parseSettings", () => {
	it("returns null for null input", () => {
		expect(parseSettings(null)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseSettings("")).toBeNull();
	});

	it("returns null when JSON.parse throws", () => {
		expect(parseSettings("{not-json}")).toBeNull();
	});

	it("returns null when parsed value is not an object (number)", () => {
		expect(parseSettings("42")).toBeNull();
	});

	it("returns null when parsed value is not an object (string)", () => {
		expect(parseSettings('"hello"')).toBeNull();
	});

	it("returns null when parsed value is JSON null", () => {
		expect(parseSettings("null")).toBeNull();
	});

	it("returns the object when parse succeeds", () => {
		expect(parseSettings('{"a":1}')).toEqual({ a: 1 });
	});

	it("returns arrays as objects too (typeof [] === 'object')", () => {
		expect(parseSettings("[1,2,3]")).toEqual([1, 2, 3]);
	});
});

describe("localeFromPath", () => {
	it("returns the matching locale when pathname has /es/ prefix", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
			locales: ["en", "es"],
		} as never);
		expect(localeFromPath("/es/about")).toBe("es");
	});

	it("returns the first locale ('en') when no prefix matches", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
			locales: ["en", "es"],
		} as never);
		expect(localeFromPath("/about")).toBe("en");
	});

	it("falls back to ['en','es'] when getCmsConfig throws (config not registered)", () => {
		// CMS config is unset → getCmsConfig throws → catch falls back to ['en','es'].
		expect(localeFromPath("/es/x")).toBe("es");
		expect(localeFromPath("/about")).toBe("en");
	});

	it("falls back to ['en','es'] when locales is missing on the config", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
		} as never);
		expect(localeFromPath("/es/x")).toBe("es");
		expect(localeFromPath("/about")).toBe("en");
	});

	it("matches strictly on `/locale/` (not on suffix or substring)", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
			locales: ["en", "es", "fr"],
		} as never);
		// "/escape" must not match "es" — leading-slash + trailing-slash anchored.
		expect(localeFromPath("/escape")).toBe("en");
	});

	it("returns 'en' fallback when locales array is empty", () => {
		// Pins `locales[0] ?? "en"`.
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
			locales: [],
		} as never);
		expect(localeFromPath("/about")).toBe("en");
	});

	it("returns the first custom locale when no prefix matches", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["content"],
			seedPages: [],
			archives: [],
			locales: ["fr", "de"],
		} as never);
		expect(localeFromPath("/about")).toBe("fr");
	});
});
