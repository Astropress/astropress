import { describe, expect, it } from "vitest";
import { createAstropressCloudflareViteIntegration } from "../src/cloudflare-vite-integration";

describe("cloudflare vite integration helper", () => {
	it("creates stub aliases and a pre-resolution plugin", () => {
		const integration = createAstropressCloudflareViteIntegration(
			"/tmp/site/src/astropress/local-runtime-modules.ts",
		);

		expect(integration.aliases).toHaveLength(13);
		expect(integration.aliases[0]).toEqual({
			find: "astropress/local-image-storage",
			replacement: "astropress/cloudflare-local-image-storage-stub",
		});
		expect(integration.aliases[1]).toEqual({
			find: /^.*\/local-image-storage(?:\.[cm]?[jt]s)?$/,
			replacement: "astropress/cloudflare-local-image-storage-stub",
		});
		expect(integration.aliases[2]).toEqual({
			find: "astropress/local-media-storage",
			replacement: "astropress/cloudflare-local-media-storage-stub",
		});
		expect(integration.aliases[3]).toEqual({
			find: /^.*\/local-media-storage(?:\.[cm]?[jt]s)?$/,
			replacement: "astropress/cloudflare-local-media-storage-stub",
		});
		expect(integration.aliases[4]).toEqual({
			find: "astropress/adapters/sqlite",
			replacement: "astropress/cloudflare-sqlite-adapter-stub",
		});
		expect(integration.aliases[5]).toEqual({
			find: /^.*\/adapters\/sqlite(?:\.[cm]?[jt]s)?$/,
			replacement: "astropress/cloudflare-sqlite-adapter-stub",
		});
		expect(integration.aliases[6]).toEqual({
			find: "astropress/sqlite-admin-runtime",
			replacement: "astropress/cloudflare-sqlite-admin-runtime-stub",
		});
		expect(integration.aliases[7]).toEqual({
			find: /^.*\/sqlite-admin-runtime(?:\.[cm]?[jt]s)?$/,
			replacement: "astropress/cloudflare-sqlite-admin-runtime-stub",
		});
		expect(integration.aliases[8]).toEqual({
			find: "astropress/sqlite-bootstrap",
			replacement: "astropress/cloudflare-sqlite-bootstrap-stub",
		});
		expect(integration.aliases[9]).toEqual({
			find: /^.*\/sqlite-bootstrap(?:\.[cm]?[jt]s)?$/,
			replacement: "astropress/cloudflare-sqlite-bootstrap-stub",
		});
		expect(integration.aliases[12]?.replacement).toBe("astropress/cloudflare-local-runtime-stubs");
		expect(integration.plugin.name).toBe("astropress-cloudflare-local-runtime-stubs");
		expect(integration.plugin.resolveId("./local-runtime-modules")).toBe(
			"astropress/cloudflare-local-runtime-stubs",
		);
		expect(integration.plugin.resolveId("astropress/local-image-storage")).toBe(
			"astropress/cloudflare-local-image-storage-stub",
		);
		expect(
			integration.plugin.resolveId("/workspace/packages/astropress/src/local-image-storage.ts"),
		).toBe("astropress/cloudflare-local-image-storage-stub");
		expect(integration.plugin.resolveId("astropress/local-media-storage")).toBe(
			"astropress/cloudflare-local-media-storage-stub",
		);
		expect(
			integration.plugin.resolveId("/workspace/packages/astropress/src/local-media-storage.ts"),
		).toBe("astropress/cloudflare-local-media-storage-stub");
		expect(integration.plugin.resolveId("astropress/adapters/sqlite")).toBe(
			"astropress/cloudflare-sqlite-adapter-stub",
		);
		expect(integration.plugin.resolveId("astropress/sqlite-admin-runtime")).toBe(
			"astropress/cloudflare-sqlite-admin-runtime-stub",
		);
		expect(integration.plugin.resolveId("astropress/sqlite-bootstrap")).toBe(
			"astropress/cloudflare-sqlite-bootstrap-stub",
		);

		// line 115: non-matching ID returns null
		expect(
			integration.plugin.resolveId("/workspace/packages/astropress/src/some-other-module.ts"),
		).toBeNull();

		// lines 23-24: file:// URL normalization (decodeURIComponent + file:// strip)
		expect(
			integration.plugin.resolveId(
				"file:///workspace/packages/astropress/src/local-image-storage.ts",
			),
		).toBe("astropress/cloudflare-local-image-storage-stub");

		// lines 26-27: Windows-style path after file:// stripping (/C:/... → C:/...)
		expect(
			integration.plugin.resolveId(
				"file:///C:/workspace/packages/astropress/src/local-image-storage.ts",
			),
		).toBe("astropress/cloudflare-local-image-storage-stub");
	});

	it("resolves every literal variant of './local-runtime-modules' (with/without leading './' and '.ts')", () => {
		const integration = createAstropressCloudflareViteIntegration("/tmp/site/lrm.ts");
		for (const id of [
			"./local-runtime-modules",
			"./local-runtime-modules.ts",
			"local-runtime-modules",
			"local-runtime-modules.ts",
		]) {
			expect(integration.plugin.resolveId(id)).toBe("astropress/cloudflare-local-runtime-stubs");
		}
	});

	it("matches the exact localRuntimeModulesPath supplied at construction time", () => {
		const integration = createAstropressCloudflareViteIntegration("/abs/path/lrm.ts");
		expect(integration.plugin.resolveId("/abs/path/lrm.ts")).toBe(
			"astropress/cloudflare-local-runtime-stubs",
		);
	});

	it("matches IDs ending in '/local-runtime-modules' or '/local-runtime-modules.ts'", () => {
		const integration = createAstropressCloudflareViteIntegration("/tmp/site/lrm.ts");
		expect(integration.plugin.resolveId("/some/path/local-runtime-modules")).toBe(
			"astropress/cloudflare-local-runtime-stubs",
		);
		expect(integration.plugin.resolveId("/some/path/local-runtime-modules.ts")).toBe(
			"astropress/cloudflare-local-runtime-stubs",
		);
	});

	it("matches every variant of local-image-storage / local-media-storage", () => {
		const integration = createAstropressCloudflareViteIntegration("/tmp/site/lrm.ts");
		for (const id of [
			"astropress/local-image-storage",
			"/a/b/local-image-storage",
			"/a/b/local-image-storage.ts",
			"/a/b/local-image-storage.js",
		]) {
			expect(integration.plugin.resolveId(id)).toBe(
				"astropress/cloudflare-local-image-storage-stub",
			);
		}
		for (const id of [
			"astropress/local-media-storage",
			"/a/b/local-media-storage",
			"/a/b/local-media-storage.ts",
			"/a/b/local-media-storage.js",
		]) {
			expect(integration.plugin.resolveId(id)).toBe(
				"astropress/cloudflare-local-media-storage-stub",
			);
		}
	});

	it("matches every variant of sqlite-admin-runtime / sqlite-adapter / sqlite-bootstrap", () => {
		const integration = createAstropressCloudflareViteIntegration("/tmp/site/lrm.ts");
		for (const id of [
			"astropress/sqlite-admin-runtime",
			"/a/b/sqlite-admin-runtime",
			"/a/b/sqlite-admin-runtime.ts",
			"/a/b/sqlite-admin-runtime.js",
		]) {
			expect(integration.plugin.resolveId(id)).toBe(
				"astropress/cloudflare-sqlite-admin-runtime-stub",
			);
		}
		for (const id of [
			"astropress/adapters/sqlite",
			"/a/b/adapters/sqlite",
			"/a/b/adapters/sqlite.ts",
			"/a/b/adapters/sqlite.js",
		]) {
			expect(integration.plugin.resolveId(id)).toBe("astropress/cloudflare-sqlite-adapter-stub");
		}
		for (const id of [
			"astropress/sqlite-bootstrap",
			"/a/b/sqlite-bootstrap",
			"/a/b/sqlite-bootstrap.ts",
			"/a/b/sqlite-bootstrap.js",
		]) {
			expect(integration.plugin.resolveId(id)).toBe("astropress/cloudflare-sqlite-bootstrap-stub");
		}
	});

	it("honours every user-supplied option override for stub paths", () => {
		const integration = createAstropressCloudflareViteIntegration("/lrm.ts", {
			cloudflareLocalImageStorageStubPath: "custom-image",
			cloudflareLocalMediaStorageStubPath: "custom-media",
			cloudflareSqliteAdapterStubPath: "custom-adapter",
			cloudflareSqliteAdminRuntimeStubPath: "custom-admin-runtime",
			cloudflareSqliteBootstrapStubPath: "custom-bootstrap",
			cloudflareLocalRuntimeStubsPath: "custom-lrm",
		});
		expect(integration.plugin.resolveId("astropress/local-image-storage")).toBe("custom-image");
		expect(integration.plugin.resolveId("astropress/local-media-storage")).toBe("custom-media");
		expect(integration.plugin.resolveId("astropress/adapters/sqlite")).toBe("custom-adapter");
		expect(integration.plugin.resolveId("astropress/sqlite-admin-runtime")).toBe(
			"custom-admin-runtime",
		);
		expect(integration.plugin.resolveId("astropress/sqlite-bootstrap")).toBe("custom-bootstrap");
		expect(integration.plugin.resolveId("./local-runtime-modules")).toBe("custom-lrm");
	});

	it("normalizes Windows backslashes to forward slashes before matching", () => {
		const integration = createAstropressCloudflareViteIntegration("/lrm.ts");
		expect(integration.plugin.resolveId("C:\\workspace\\src\\local-image-storage.ts")).toBe(
			"astropress/cloudflare-local-image-storage-stub",
		);
	});
});
