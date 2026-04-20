import { createAstropressVitestLocalRuntimePlugins } from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";

describe("vitest runtime alias helpers", () => {
	it("creates the local module replacement and external source rewrite plugins", () => {
		const [replacePlugin, rewritePlugin] =
			createAstropressVitestLocalRuntimePlugins(
				"/tmp/site/src/astropress/local-runtime-modules.ts",
			);

		expect(replacePlugin.name).toBe(
			"astropress-local-runtime-modules-replacer",
		);
		expect(replacePlugin.resolveId("./local-runtime-modules")).toBe(
			"/tmp/site/src/astropress/local-runtime-modules.ts",
		);

		expect(rewritePlugin.name).toBe("astropress-external-source-rewriter");
		expect(
			rewritePlugin.resolveId(
				"./local-runtime-modules",
				"/tmp/site/node_modules/.bun/astropress@file+pkg/node_modules/astropress/src/runtime-page-store.ts",
			),
		).toBe("/tmp/site/src/astropress/local-runtime-modules.ts");
	});

	it("does not rewrite unrelated imports", () => {
		const [, rewritePlugin] = createAstropressVitestLocalRuntimePlugins(
			"/tmp/site/src/astropress/local-runtime-modules.ts",
		);

		expect(
			rewritePlugin.resolveId(
				"./other-module",
				"/tmp/site/node_modules/astropress/src/runtime-page-store.ts",
			),
		).toBe(undefined);
		expect(
			rewritePlugin.resolveId(
				"./local-runtime-modules",
				"/tmp/site/src/app.ts",
			),
		).toBe(undefined);
	});
});
