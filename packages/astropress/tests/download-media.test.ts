import { describe, expect, it, vi } from "vitest";
import {
	downloadMedia,
	validateMediaSourceUrl,
} from "../src/import/download-media.js";

describe("validateMediaSourceUrl", () => {
	it("accepts http URLs", () => {
		expect(() =>
			validateMediaSourceUrl("http://example.com/image.jpg"),
		).not.toThrow();
	});

	it("accepts https URLs", () => {
		expect(() =>
			validateMediaSourceUrl("https://example.com/image.png"),
		).not.toThrow();
	});

	it("blocks data: URLs", () => {
		expect(() => validateMediaSourceUrl("data:image/png;base64,abc")).toThrow(
			"Blocked non-HTTP URL scheme: data:",
		);
	});

	it("blocks file: URLs", () => {
		expect(() => validateMediaSourceUrl("file:///etc/passwd")).toThrow(
			"Blocked non-HTTP URL scheme: file:",
		);
	});

	it("blocks javascript: URLs", () => {
		expect(() => validateMediaSourceUrl("javascript:alert(1)")).toThrow(
			"Blocked non-HTTP URL scheme: javascript:",
		);
	});

	it("blocks localhost", () => {
		expect(() => validateMediaSourceUrl("http://localhost/secret")).toThrow(
			"Blocked request to private/loopback host",
		);
	});

	it("blocks 127.0.0.1", () => {
		expect(() => validateMediaSourceUrl("http://127.0.0.1/secret")).toThrow(
			"Blocked request to private/loopback host",
		);
	});

	it("blocks 10.x private range", () => {
		expect(() => validateMediaSourceUrl("http://10.0.0.1/secret")).toThrow(
			"Blocked request to private/loopback host",
		);
	});

	it("blocks 192.168.x private range", () => {
		expect(() => validateMediaSourceUrl("http://192.168.1.1/secret")).toThrow(
			"Blocked request to private/loopback host",
		);
	});

	it("blocks 172.16-31.x private range", () => {
		expect(() => validateMediaSourceUrl("http://172.16.0.1/secret")).toThrow(
			"Blocked request to private/loopback host",
		);
	});

	it("blocks 169.254.x link-local range", () => {
		expect(() =>
			validateMediaSourceUrl("http://169.254.169.254/latest/meta-data"),
		).toThrow("Blocked request to private/loopback host");
	});

	it("rejects invalid URLs", () => {
		expect(() => validateMediaSourceUrl("not a url")).toThrow("Invalid URL");
	});

	it("returns parsed URL for valid input", () => {
		const url = validateMediaSourceUrl("https://cdn.example.com/img.jpg");
		expect(url.hostname).toBe("cdn.example.com");
	});
});

describe("downloadMedia", () => {
	it("rejects non-media content-type", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("<html></html>", {
						status: 200,
						headers: { "content-type": "text/html" },
					}),
			),
		);
		await expect(downloadMedia("https://example.com/page")).rejects.toThrow(
			'Blocked: unexpected media content-type "text/html"',
		);
		vi.unstubAllGlobals();
	});

	it("rejects responses exceeding size limit via content-length", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(new Uint8Array(10), {
						status: 200,
						headers: {
							"content-type": "image/jpeg",
							"content-length": String(60 * 1024 * 1024),
						},
					}),
			),
		);
		await expect(downloadMedia("https://example.com/huge.jpg")).rejects.toThrow(
			"exceeds",
		);
		vi.unstubAllGlobals();
	});

	it("rejects non-OK HTTP responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 404 })),
		);
		await expect(
			downloadMedia("https://example.com/missing.jpg"),
		).rejects.toThrow("HTTP 404");
		vi.unstubAllGlobals();
	});

	it("returns bytes for valid image response", async () => {
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(jpeg, {
						status: 200,
						headers: { "content-type": "image/jpeg" },
					}),
			),
		);
		const bytes = await downloadMedia("https://example.com/photo.jpg");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBe(4);
		vi.unstubAllGlobals();
	});

	it("rejects private IP before making any network call", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		await expect(downloadMedia("http://192.168.0.1/secret")).rejects.toThrow(
			"Blocked request to private/loopback host",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});
