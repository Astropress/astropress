// Scheme/host validation for operator-configured embed URLs (#109). The admin
// CMS + host panels feed these into iframe src / href, so the allowed set
// (https anywhere, http only for loopback) and the rejected set (every other
// scheme + malformed values) are both asserted.
import { describe, expect, it } from "vitest";

import { validateEmbedUrl } from "../src/admin-embed-url.js";

describe("validateEmbedUrl — allowed", () => {
	it("accepts an https URL and returns the normalised href", () => {
		const r = validateEmbedUrl("https://cms.example.com/admin");
		expect(r.ok).toBe(true);
		expect(r.url).toBe("https://cms.example.com/admin");
	});

	it("accepts http only for loopback hosts", () => {
		for (const host of ["localhost", "127.0.0.1", "[::1]", "0.0.0.0", "app.localhost"]) {
			const r = validateEmbedUrl(`http://${host}:4321/panel`);
			expect(r.ok, host).toBe(true);
		}
	});
});

describe("validateEmbedUrl — rejected", () => {
	it("rejects http to a non-loopback host", () => {
		const r = validateEmbedUrl("http://cms.example.com/admin");
		expect(r.ok).toBe(false);
		expect(r.reason).toMatch(/https/i);
	});

	it("rejects javascript: URLs", () => {
		expect(validateEmbedUrl("javascript:alert(document.cookie)").ok).toBe(false);
	});

	it("rejects data: URLs", () => {
		expect(validateEmbedUrl("data:text/html,<script>alert(1)</script>").ok).toBe(false);
	});

	it("rejects file: URLs", () => {
		expect(validateEmbedUrl("file:///etc/passwd").ok).toBe(false);
	});

	it("rejects vbscript: and blob: URLs", () => {
		expect(validateEmbedUrl("vbscript:msgbox(1)").ok).toBe(false);
		expect(validateEmbedUrl("blob:https://x/y").ok).toBe(false);
	});

	it("rejects empty, whitespace, and missing values", () => {
		expect(validateEmbedUrl("").ok).toBe(false);
		expect(validateEmbedUrl("   ").ok).toBe(false);
		expect(validateEmbedUrl(null).ok).toBe(false);
		expect(validateEmbedUrl(undefined).ok).toBe(false);
	});

	it("rejects a relative or non-absolute value", () => {
		expect(validateEmbedUrl("/just/a/path").ok).toBe(false);
		expect(validateEmbedUrl("not a url").ok).toBe(false);
	});

	it("never returns a url on rejection", () => {
		const r = validateEmbedUrl("javascript:alert(1)");
		expect(r.ok).toBe(false);
		expect(r.url).toBeUndefined();
		expect(typeof r.reason).toBe("string");
	});
});
