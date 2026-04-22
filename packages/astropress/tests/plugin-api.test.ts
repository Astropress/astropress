import { describe, expect, it } from "vitest";

import {
	dispatchPluginContentEvent,
	dispatchPluginMediaEvent,
	peekCmsConfig,
	registerCms,
} from "../src/config.js";
import type { AstropressPlugin } from "../src/config.js";

function makeMinimalConfig(plugins?: AstropressPlugin[]) {
	return {
		templateKeys: ["home"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
		plugins,
	};
}

describe("AstropressPlugin API", () => {
	it("dispatchPluginContentEvent calls onContentSave on registered plugins", async () => {
		const events: string[] = [];
		const plugin: AstropressPlugin = {
			name: "test-plugin",
			onContentSave: ({ slug }) => {
				events.push(`save:${slug}`);
			},
		};
		registerCms(makeMinimalConfig([plugin]));

		await dispatchPluginContentEvent("onContentSave", {
			slug: "my-post",
			kind: "post",
			status: "draft",
			actor: "admin@example.com",
		});

		expect(events).toEqual(["save:my-post"]);
	});

	it("dispatchPluginContentEvent calls onContentPublish only for published status", async () => {
		const events: string[] = [];
		const plugin: AstropressPlugin = {
			name: "publish-plugin",
			onContentPublish: ({ slug }) => {
				events.push(`publish:${slug}`);
			},
		};
		registerCms(makeMinimalConfig([plugin]));

		await dispatchPluginContentEvent("onContentPublish", {
			slug: "my-post",
			kind: "post",
			status: "published",
			actor: "admin@example.com",
		});
		await dispatchPluginContentEvent("onContentSave", {
			slug: "draft-post",
			kind: "post",
			status: "draft",
			actor: "admin@example.com",
		});

		expect(events).toEqual(["publish:my-post"]);
	});

	it("dispatchPluginContentEvent catches errors thrown by plugin hooks", async () => {
		const errorPlugin: AstropressPlugin = {
			name: "broken-plugin",
			onContentSave: () => {
				throw new Error("plugin error");
			},
		};
		registerCms(makeMinimalConfig([errorPlugin]));

		// Should not throw
		await expect(
			dispatchPluginContentEvent("onContentSave", {
				slug: "post",
				kind: "post",
				status: "draft",
				actor: "admin@example.com",
			}),
		).resolves.toBeUndefined();
	});

	it("dispatchPluginContentEvent is a no-op when no plugins are registered", async () => {
		registerCms(makeMinimalConfig([]));
		await expect(
			dispatchPluginContentEvent("onContentSave", {
				slug: "post",
				kind: "post",
				status: "draft",
				actor: "admin@example.com",
			}),
		).resolves.toBeUndefined();
	});

	it("dispatchPluginMediaEvent calls onMediaUpload on registered plugins", async () => {
		const uploads: string[] = [];
		const plugin: AstropressPlugin = {
			name: "media-plugin",
			onMediaUpload: ({ id, mimeType }) => {
				uploads.push(`${id}:${mimeType}`);
			},
		};
		registerCms(makeMinimalConfig([plugin]));

		await dispatchPluginMediaEvent({
			id: "asset-1",
			filename: "photo.jpg",
			mimeType: "image/jpeg",
			size: 1024,
			actor: "admin@example.com",
		});

		expect(uploads).toEqual(["asset-1:image/jpeg"]);
	});

	it("dispatchPluginMediaEvent catches errors thrown by onMediaUpload hooks", async () => {
		const brokenPlugin: AstropressPlugin = {
			name: "broken-media-plugin",
			onMediaUpload: () => {
				throw new Error("media plugin error");
			},
		};
		registerCms(makeMinimalConfig([brokenPlugin]));

		await expect(
			dispatchPluginMediaEvent({
				id: "a",
				filename: "f.jpg",
				mimeType: "image/jpeg",
				size: 0,
				actor: "x@y.com",
			}),
		).resolves.toBeUndefined();
	});

	it("plugins with navItems expose them via getCmsConfig", () => {
		const navPlugin: AstropressPlugin = {
			name: "nav-plugin",
			navItems: [{ label: "My Tool", href: "/ap-admin/my-tool" }],
		};
		registerCms(makeMinimalConfig([navPlugin]));
		const config = peekCmsConfig();
		expect(config?.plugins?.[0]?.navItems?.[0]?.label).toBe("My Tool");
	});

	it("plugin adminRoutes are stored in config and accessible via peekCmsConfig", () => {
		const routePlugin: AstropressPlugin = {
			name: "route-plugin",
			adminRoutes: [
				{
					pattern: "/ap-admin/my-plugin",
					entrypoint: "./src/pages/my-plugin-admin.astro",
				},
				{
					pattern: "/ap-admin/my-plugin/settings",
					entrypoint: "./src/pages/my-plugin-settings.astro",
				},
			],
		};
		registerCms(makeMinimalConfig([routePlugin]));
		const config = peekCmsConfig();
		const routes = config?.plugins?.[0]?.adminRoutes;
		expect(routes).toHaveLength(2);
		expect(routes?.[0]?.pattern).toBe("/ap-admin/my-plugin");
		expect(routes?.[0]?.entrypoint).toBe("./src/pages/my-plugin-admin.astro");
		expect(routes?.[1]?.pattern).toBe("/ap-admin/my-plugin/settings");
	});

	it("plugin with no adminRoutes does not break config access", () => {
		const plainPlugin: AstropressPlugin = { name: "plain-plugin" };
		registerCms(makeMinimalConfig([plainPlugin]));
		const config = peekCmsConfig();
		expect(config?.plugins?.[0]?.adminRoutes).toBeUndefined();
	});
});

describe("createSitemapPlugin", () => {
	it("source file exists and exports createSitemapPlugin", async () => {
		const { createSitemapPlugin: fn } = await import(
			"../src/plugins/sitemap-plugin.js"
		);
		expect(typeof fn).toBe("function");
	});

	it("returned plugin has name 'astropress-sitemap' and onContentPublish hook", async () => {
		const { createSitemapPlugin: fn } = await import(
			"../src/plugins/sitemap-plugin.js"
		);
		const plugin = fn();
		expect(plugin.name).toBe("astropress-sitemap");
		expect(typeof plugin.onContentPublish).toBe("function");
	});

	it("onContentPublish calls onPublish callback with slug", async () => {
		const { createSitemapPlugin: fn } = await import(
			"../src/plugins/sitemap-plugin.js"
		);
		const slugs: string[] = [];
		const plugin = fn({
			onPublish: (slug: string) => {
				slugs.push(slug);
			},
		});
		await plugin.onContentPublish?.({
			slug: "my-post",
			kind: "post",
			status: "published",
			actor: "admin@example.com",
		});
		expect(slugs).toEqual(["my-post"]);
	});
});
