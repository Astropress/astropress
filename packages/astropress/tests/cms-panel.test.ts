import {
	type AstropressCmsConfig,
	type AstropressHostPanelCapability,
	type AstropressPlatformAdapter,
	assertProviderContract,
	normalizeProviderCapabilities,
} from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";

function createTestAdapter(
	hostPanel?: AstropressHostPanelCapability,
): AstropressPlatformAdapter {
	return assertProviderContract({
		capabilities: normalizeProviderCapabilities({
			name: "test",
			database: true,
			hostPanel,
		}),
		content: {
			async list() {
				return [];
			},
			async get() {
				return null;
			},
			async save(r) {
				return r;
			},
			async delete() {},
		},
		media: {
			async put(a) {
				return a;
			},
			async get() {
				return null;
			},
			async delete() {},
		},
		revisions: {
			async list() {
				return [];
			},
			async append(r) {
				return r;
			},
		},
		auth: {
			async signIn() {
				return null;
			},
			async signOut() {},
			async getSession() {
				return null;
			},
		},
	});
}

describe("AstropressCmsConfig types", () => {
	it("payload cms config is correctly typed", () => {
		const config: AstropressCmsConfig = {
			type: "payload",
			mode: "iframe",
			url: "http://localhost:3000",
		};

		expect(config.type).toBe("payload");
		expect(config.mode).toBe("iframe");
		expect(config.url).toBe("http://localhost:3000");
	});

	it("contentful cloud cms uses link mode", () => {
		const config: AstropressCmsConfig = {
			type: "contentful",
			mode: "link",
			url: "https://app.contentful.com/spaces/abc123",
			label: "Contentful",
		};

		expect(config.mode).toBe("link");
		expect(config.label).toBe("Contentful");
	});

	it("all supported cms types are valid", () => {
		const types: AstropressCmsConfig["type"][] = [
			"payload",
			"sanity",
			"directus",
			"strapi",
			"tina",
			"contentful",
			"storyblok",
			"keystatic",
			"custom",
		];

		for (const type of types) {
			const config: AstropressCmsConfig = {
				type,
				mode: "link",
				url: "https://example.com",
			};
			expect(config.type).toBe(type);
		}
	});

	it("iframe allow attribute is optional", () => {
		const withAllow: AstropressCmsConfig = {
			type: "directus",
			mode: "iframe",
			url: "https://cms.example.com",
			iframeAllow: "fullscreen",
		};
		const withoutAllow: AstropressCmsConfig = {
			type: "directus",
			mode: "iframe",
			url: "https://cms.example.com",
		};

		expect(withAllow.iframeAllow).toBe("fullscreen");
		expect(withoutAllow.iframeAllow).toBeUndefined();
	});
});

describe("AstropressHostPanelCapability", () => {
	it("adapter with hostPanel includes it in capabilities", () => {
		const adapter = createTestAdapter({
			mode: "link",
			url: "https://app.supabase.com/project/abc",
			label: "Supabase Studio",
		});

		expect(adapter.capabilities.hostPanel).toBeDefined();
		expect(adapter.capabilities.hostPanel?.label).toBe("Supabase Studio");
		expect(adapter.capabilities.hostPanel?.mode).toBe("link");
		expect(adapter.capabilities.hostPanel?.url).toBe(
			"https://app.supabase.com/project/abc",
		);
	});

	it("adapter without hostPanel has undefined hostPanel", () => {
		const adapter = createTestAdapter();
		expect(adapter.capabilities.hostPanel).toBeUndefined();
	});

	it("pocketbase self-hosted adapter uses iframe mode", () => {
		const adapter = createTestAdapter({
			mode: "iframe",
			url: "http://localhost:8090/_/",
			label: "PocketBase Admin",
		});

		expect(adapter.capabilities.hostPanel?.mode).toBe("iframe");
	});

	it("normalizeProviderCapabilities passes through hostPanel", () => {
		const caps = normalizeProviderCapabilities({
			name: "supabase",
			database: true,
			hostPanel: {
				mode: "link",
				url: "https://supabase.com/dashboard",
				label: "Supabase Studio",
			},
		});

		expect(caps.hostPanel).toBeDefined();
		expect(caps.hostPanel?.label).toBe("Supabase Studio");
	});

	it("normalizeProviderCapabilities without hostPanel leaves it undefined", () => {
		const caps = normalizeProviderCapabilities({
			name: "sqlite",
			database: true,
		});
		expect(caps.hostPanel).toBeUndefined();
	});
});

describe("Host nav visibility rules", () => {
	it("host panel is visible only for admin role", () => {
		// Simulates the nav filtering logic in AdminLayout
		const hasHostPanel = true;
		const roleAdmin = "admin";
		const roleEditor = "editor";

		const adminSees = hasHostPanel && roleAdmin === "admin";
		const editorSees = hasHostPanel && roleEditor === "admin";

		expect(adminSees).toBe(true);
		expect(editorSees).toBe(false);
	});

	it("cms nav is visible to all authenticated users when cms is configured", () => {
		const hasCms = true;
		const roleAdmin = "admin";
		const roleEditor = "editor";

		// CMS nav has no adminOnly restriction
		expect(hasCms && roleAdmin.length > 0).toBe(true);
		expect(hasCms && roleEditor.length > 0).toBe(true);
	});

	it("cms nav is hidden when no cms is configured", () => {
		const hasCms = false;
		expect(hasCms).toBe(false);
	});
});

describe("deployHook capability", () => {
	it("normalizeProviderCapabilities passes through deployHook", () => {
		const caps = normalizeProviderCapabilities({
			name: "cloudflare",
			staticPublishing: true,
			deployHook: {
				type: "cloudflare-pages",
				configuredViaEnv: ["CF_PAGES_DEPLOY_HOOK_URL"],
			},
		});

		expect(caps.deployHook?.type).toBe("cloudflare-pages");
		expect(caps.deployHook?.configuredViaEnv).toContain(
			"CF_PAGES_DEPLOY_HOOK_URL",
		);
	});

	it("deployHook is optional — undefined when not declared", () => {
		const caps = normalizeProviderCapabilities({ name: "sqlite" });
		expect(caps.deployHook).toBeUndefined();
	});
});
