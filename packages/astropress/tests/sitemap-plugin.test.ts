import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSitemapPlugin } from "../src/plugins/sitemap-plugin.js";

const event = {
	slug: "my-post",
	kind: "post" as const,
	status: "published" as const,
	actor: "admin@example.com",
};

describe("createSitemapPlugin", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 200 }));
	});
	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("does NOT call fetch when purgeUrl is omitted", async () => {
		const plugin = createSitemapPlugin();
		await plugin.onContentPublish?.(event);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("does NOT call onPublish when callback is omitted (no-op safe)", async () => {
		const plugin = createSitemapPlugin();
		await expect(plugin.onContentPublish?.(event)).resolves.toBeUndefined();
	});

	it("POSTs to purgeUrl with JSON content-type and slug+event body", async () => {
		const plugin = createSitemapPlugin({ purgeUrl: "https://h.example/purge" });
		await plugin.onContentPublish?.(event);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://h.example/purge");
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
			"application/json",
		);
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.slug).toBe("my-post");
		expect(body.event).toBe("content.publish");
		expect(typeof body.purgedAt).toBe("string");
		// purgedAt is an ISO timestamp.
		expect(body.purgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("swallows fetch failures and warns to console.warn (non-fatal)", async () => {
		fetchSpy.mockRejectedValueOnce(new Error("network down"));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const plugin = createSitemapPlugin({ purgeUrl: "https://h.example/p" });
		await expect(plugin.onContentPublish?.(event)).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toContain("astropress-sitemap");
		expect(msg).toContain("my-post");
		warnSpy.mockRestore();
	});

	it("invokes onPublish before POSTing to purgeUrl", async () => {
		const order: string[] = [];
		fetchSpy.mockImplementation(async () => {
			order.push("fetch");
			return new Response(null, { status: 200 });
		});
		const plugin = createSitemapPlugin({
			purgeUrl: "https://h.example/p",
			onPublish: () => {
				order.push("onPublish");
			},
		});
		await plugin.onContentPublish?.(event);
		expect(order).toEqual(["onPublish", "fetch"]);
	});

	it("awaits an async onPublish callback", async () => {
		let resolved = false;
		const plugin = createSitemapPlugin({
			onPublish: async () => {
				await new Promise((r) => setTimeout(r, 10));
				resolved = true;
			},
		});
		await plugin.onContentPublish?.(event);
		expect(resolved).toBe(true);
	});

	it("default options ({}) yields a plugin with no fetch and no callback effects", async () => {
		const plugin = createSitemapPlugin({});
		await plugin.onContentPublish?.(event);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
