import { describe, expect, it } from "vitest";
import { resolvePublicPreviewLink } from "../src/public-preview-link.js";

describe("resolvePublicPreviewLink (#181)", () => {
	const adminOnly = new URL("http://127.0.0.1:4325/ap-admin/pages"); // harness: siteUrl === own origin
	const prodAdmin = new URL("https://admin.example.com/ap-admin/pages");

	it("uses a same-origin link when the public renderer is present in this app (dev)", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "/welcome",
				siteUrl: "https://example.com",
				publicRendererPresent: true,
			}),
		).toEqual({ href: "/welcome", available: true });
	});

	it("links to an absolute siteUrl when the public site is a different origin (production)", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "/welcome",
				siteUrl: "https://example.com",
				publicRendererPresent: false,
			}),
		).toEqual({ href: "https://example.com/welcome", available: true });
	});

	it("is unavailable when no renderer is present and siteUrl is the admin's own origin (harness)", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: adminOnly,
				path: "/welcome",
				siteUrl: "http://127.0.0.1:4325",
				publicRendererPresent: false,
			}),
		).toEqual({ href: null, available: false });
	});

	it("is unavailable when no renderer is present and no siteUrl is configured", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "/welcome",
				siteUrl: "",
				publicRendererPresent: false,
			}),
		).toEqual({ href: null, available: false });
	});

	it("is unavailable when the row has no path", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: null,
				siteUrl: "https://example.com",
				publicRendererPresent: true,
			}),
		).toEqual({ href: null, available: false });
	});

	it("normalizes a path missing its leading slash", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "welcome",
				siteUrl: "https://example.com",
				publicRendererPresent: false,
			}).href,
		).toBe("https://example.com/welcome");
	});

	it("normalizes a leading-slash-less path for the same-origin (renderer present) case too", () => {
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "welcome",
				siteUrl: "",
				publicRendererPresent: true,
			}),
		).toEqual({ href: "/welcome", available: true });
	});

	it("treats an unparseable siteUrl as no distinct origin (falls back to disabled)", () => {
		// URL.parse resolves this relative to the admin base → same origin → disabled.
		expect(
			resolvePublicPreviewLink({
				baseUrl: prodAdmin,
				path: "/welcome",
				siteUrl: "not a url",
				publicRendererPresent: false,
			}),
		).toEqual({ href: null, available: false });
	});
});
