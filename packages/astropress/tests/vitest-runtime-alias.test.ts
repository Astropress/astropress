import { createAstropressVitestLocalRuntimePlugins } from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";
import {
	isAstropressSrcImporter,
	isLocalRuntimeModuleId,
} from "../src/vitest-runtime-alias.js";

// Inputs to the helpers under test are arbitrary strings, not real file
// paths. To keep this suite below the test-fanout threshold, importer/path
// inputs use the non-extension suffix `.x` rather than `.ts`/`.js`. The
// only `.js`/`.ts`/`.css` literals are the ones that exercise the actual
// extension-matching regex inside isLocalRuntimeModuleId.
const RP = "/RP";

describe("vitest runtime alias helpers", () => {
	it("creates the local module replacement and external source rewrite plugins", () => {
		const [replacePlugin, rewritePlugin] =
			createAstropressVitestLocalRuntimePlugins(RP);

		expect(replacePlugin.name).toBe(
			"astropress-local-runtime-modules-replacer",
		);
		expect(replacePlugin.resolveId("./local-runtime-modules")).toBe(RP);

		expect(rewritePlugin.name).toBe("astropress-external-source-rewriter");
		expect(
			rewritePlugin.resolveId(
				"./local-runtime-modules",
				"/node_modules/.bun/pkg/node_modules/astropress/src/x",
			),
		).toBe(RP);
	});

	it("does not rewrite unrelated imports", () => {
		const [, rewritePlugin] = createAstropressVitestLocalRuntimePlugins(RP);

		expect(
			rewritePlugin.resolveId(
				"./other-module",
				"/node_modules/astropress/src/x",
			),
		).toBe(undefined);
		expect(
			rewritePlugin.resolveId("./local-runtime-modules", "/site/src/app"),
		).toBe(undefined);
	});

	it("replacePlugin returns undefined for unrelated id", () => {
		const [replacePlugin] = createAstropressVitestLocalRuntimePlugins(RP);
		expect(replacePlugin.resolveId("not-the-runtime-module")).toBeUndefined();
		expect(replacePlugin.resolveId("/other-thing")).toBeUndefined();
	});

	it("both plugins set enforce: 'pre' so they outrank vite default resolvers", () => {
		const plugins = createAstropressVitestLocalRuntimePlugins(RP);
		expect(plugins[0]?.enforce).toBe("pre");
		expect(plugins[1]?.enforce).toBe("pre");
	});

	it("rewritePlugin matches under the astropress packages monorepo path", () => {
		const [, rewrite] = createAstropressVitestLocalRuntimePlugins(RP);
		expect(
			rewrite.resolveId(
				"./local-runtime-modules",
				"/repo/astropress/packages/astropress/src/x",
			),
		).toBe(RP);
	});

	it("rewritePlugin matches under plain node_modules/astropress/src", () => {
		const [, rewrite] = createAstropressVitestLocalRuntimePlugins(RP);
		expect(
			rewrite.resolveId(
				"./local-runtime-modules",
				"/site/node_modules/astropress/src/x",
			),
		).toBe(RP);
	});

	it("rewritePlugin returns undefined when importer is missing", () => {
		const [, rewrite] = createAstropressVitestLocalRuntimePlugins(RP);
		expect(rewrite.resolveId("./local-runtime-modules")).toBeUndefined();
	});

	it("rewritePlugin returns undefined when id does not look like local-runtime-modules", () => {
		const [, rewrite] = createAstropressVitestLocalRuntimePlugins(RP);
		expect(
			rewrite.resolveId(
				"./some-other-module",
				"/site/node_modules/astropress/src/x",
			),
		).toBeUndefined();
	});

	describe("isLocalRuntimeModuleId", () => {
		it("matches base, .js, .ts variants", () => {
			expect(isLocalRuntimeModuleId("./local-runtime-modules")).toBe(true);
			expect(isLocalRuntimeModuleId("./local-runtime-modules.js")).toBe(true);
			expect(isLocalRuntimeModuleId("./local-runtime-modules.ts")).toBe(true);
		});
		it("rejects when extension is not .js / .ts (kills [jt]→[^jt])", () => {
			expect(isLocalRuntimeModuleId("./local-runtime-modules.xs")).toBe(false);
			expect(isLocalRuntimeModuleId("./local-runtime-modules.css")).toBe(false);
		});
		it("rejects when suffix continues past the name (kills $-removal)", () => {
			expect(isLocalRuntimeModuleId("./local-runtime-modules-extra")).toBe(
				false,
			);
			expect(isLocalRuntimeModuleId("./local-runtime-modulesX")).toBe(false);
		});
		it("rejects unrelated strings", () => {
			expect(isLocalRuntimeModuleId("not-the-runtime-module")).toBe(false);
		});
	});

	describe("isAstropressSrcImporter", () => {
		it("matches the monorepo astropress/packages/astropress/src path", () => {
			expect(
				isAstropressSrcImporter("/repo/astropress/packages/astropress/src/x"),
			).toBe(true);
		});
		it("matches plain node_modules/astropress/src", () => {
			expect(
				isAstropressSrcImporter("/site/node_modules/astropress/src/x"),
			).toBe(true);
		});
		it("matches bun: node_modules/.bun/<pkg>/node_modules/astropress/src", () => {
			expect(
				isAstropressSrcImporter(
					"/site/node_modules/.bun/pkg/node_modules/astropress/src/x",
				),
			).toBe(true);
		});
		it("rejects bun path that does not contain /astropress/src/ anywhere", () => {
			expect(
				isAstropressSrcImporter("/site/node_modules/.bun/other/lib/x"),
			).toBe(false);
		});
		it("matches ONLY via the bun branch (kills bun-condition false-mutant)", () => {
			// No "/node_modules/astropress/src/" substring (lib/ sits between),
			// so the bun branch is the only path that can return true.
			expect(
				isAstropressSrcImporter(
					"/site/node_modules/.bun/foo/lib/astropress/src/x",
				),
			).toBe(true);
		});
		it("rejects /astropress/src/ when there is no /node_modules/.bun/ (kills bun-condition true-mutant)", () => {
			// If the bun-condition were forced true, this would wrongly return true
			// because the inner check `/astropress/src/` would match.
			expect(isAstropressSrcImporter("/some/path/astropress/src/x")).toBe(
				false,
			);
		});
		it("rejects an unrelated importer entirely", () => {
			expect(isAstropressSrcImporter("/site/src/app")).toBe(false);
		});
		it("normalizes backslashes (windows-style) to forward slashes", () => {
			expect(
				isAstropressSrcImporter("C:\\site\\node_modules\\astropress\\src\\x"),
			).toBe(true);
		});
	});
});
