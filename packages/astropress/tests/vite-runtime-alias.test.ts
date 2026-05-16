import {
	createAstropressLocalRuntimeModulePlugin,
	createAstropressPackageResolverPlugin,
	createAstropressViteAliases,
	isAstropressLocalRuntimeModuleRequest,
} from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";

describe("vite runtime alias helpers", () => {
	const localRuntimeModulesPath = "/tmp/site/src/astropress/local-runtime-modules.ts";

	it("matches relative and resolved local runtime module requests", () => {
		expect(
			isAstropressLocalRuntimeModuleRequest("./local-runtime-modules", localRuntimeModulesPath),
		).toBe(true);
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"/tmp/site/src/astropress/local-runtime-modules.ts",
				localRuntimeModulesPath,
			),
		).toBe(true);
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"file:///tmp/site/src/astropress/local-runtime-modules.ts",
				localRuntimeModulesPath,
			),
		).toBe(true);
		expect(isAstropressLocalRuntimeModuleRequest("./something-else", localRuntimeModulesPath)).toBe(
			false,
		);
	});

	it("creates a pre-resolution plugin that rewrites runtime module imports", () => {
		const plugin = createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath);

		expect(plugin.name).toBe("astropress-local-runtime-modules");
		expect(plugin.enforce).toBe("pre");
		expect(plugin.resolveId("./local-runtime-modules")).toBe(localRuntimeModulesPath);
		expect(plugin.resolveId("./not-it")).toBeNull();
	});

	it("normalizes Windows-style file:// URLs to a drive-letter path", () => {
		// After file:// stripping, /C:/path matches ^/[a-zA-Z]:/ → slice(1) → C:/path
		const winPath = "C:/site/src/astropress/local-runtime-modules.ts";
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"file:///C:/site/src/astropress/local-runtime-modules.ts",
				winPath,
			),
		).toBe(true);
	});

	it("intercepts the scoped package import path used by Vite when noExternal is active", () => {
		// When ssr.noExternal includes '@astropress-diy/astropress', Vite processes
		// the package through its plugin pipeline. Imports inside the dist files
		// (e.g. admin-store-dispatch.js → "./local-runtime-modules") still arrive
		// as the raw "./local-runtime-modules" string and are handled by the first
		// check. The scoped-package form is used when a consumer imports directly:
		//   import ... from "@astropress-diy/astropress/local-runtime-modules"
		// Both must be caught so the host's SQLite implementation is used, not the
		// dist stub that throws `unavailable()`.
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"@astropress-diy/astropress/local-runtime-modules",
				localRuntimeModulesPath,
			),
		).toBe(true);
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"@astropress-diy/astropress/local-runtime-modules.ts",
				localRuntimeModulesPath,
			),
		).toBe(true);
	});

	it("intercepts absolute dist-stub paths that Vite may resolve before calling resolveId", () => {
		// With noExternal active, Vite can resolve the relative import to an
		// absolute path (pointing into the package dist) before the plugin's
		// resolveId runs. Both Unix and Windows forms must be handled.
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"/home/runner/work/astropress/packages/astropress/dist/src/local-runtime-modules.js",
				localRuntimeModulesPath,
			),
		).toBe(true);
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"C:/work/astropress/packages/astropress/dist/src/local-runtime-modules.js",
				localRuntimeModulesPath,
			),
		).toBe(true);
		// Unrelated absolute paths must not match.
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"/home/runner/work/astropress/packages/astropress/dist/src/admin-store-dispatch.js",
				localRuntimeModulesPath,
			),
		).toBe(false);
	});

	it("builds alias rules for local runtime modules and cloudflare workers stubs", () => {
		const aliases = createAstropressViteAliases({
			localRuntimeModulesPath,
			cloudflareWorkersStubPath: "/tmp/site/src/cloudflare-workers-stub.ts",
		});

		expect(aliases).toHaveLength(3);
		expect(aliases[0]).toEqual({
			find: "cloudflare:workers",
			replacement: "/tmp/site/src/cloudflare-workers-stub.ts",
		});
		expect(aliases[1].replacement).toBe(localRuntimeModulesPath);
		expect(aliases[2].replacement).toBe(localRuntimeModulesPath);
	});
});

describe("createAstropressPackageResolverPlugin — npm consumer bare-import redirect", () => {
	// Regression guard: Vite 7's module runner does not invoke resolveId plugins for
	// bare specifiers imported from within node_modules files when the package is
	// listed under noExternal. The correct fix is that published .astro pages must use
	// the scoped package name (@astropress-diy/astropress/…) directly. This plugin
	// remains as belt-and-suspenders for user-land imports only. Tests here verify the
	// plugin's resolution logic is correct for the cases it does handle.
	const packageRoot = "/home/site/node_modules/@astropress-diy/astropress";

	it("has the expected plugin metadata", () => {
		const plugin = createAstropressPackageResolverPlugin(packageRoot);
		expect(plugin.name).toBe("astropress-package-resolver");
		expect(plugin.enforce).toBe("pre");
	});

	it("resolves bare astropress to dist/index.js", () => {
		const plugin = createAstropressPackageResolverPlugin(packageRoot);
		expect(plugin.resolveId("astropress")).toBe(`${packageRoot}/dist/index.js`);
	});

	it("resolves astropress/components/X to the package components directory", () => {
		const plugin = createAstropressPackageResolverPlugin(packageRoot);
		expect(plugin.resolveId("astropress/components/AdminLayout.astro")).toBe(
			`${packageRoot}/components/AdminLayout.astro`,
		);
		expect(plugin.resolveId("astropress/components/CsrfInput.astro")).toBe(
			`${packageRoot}/components/CsrfInput.astro`,
		);
	});

	it("resolves astropress/X subpaths to dist/src/X.js", () => {
		const plugin = createAstropressPackageResolverPlugin(packageRoot);
		expect(plugin.resolveId("astropress/services-config")).toBe(
			`${packageRoot}/dist/src/services-config.js`,
		);
		expect(plugin.resolveId("astropress/newsletter-adapter")).toBe(
			`${packageRoot}/dist/src/newsletter-adapter.js`,
		);
		expect(plugin.resolveId("astropress/runtime-env")).toBe(
			`${packageRoot}/dist/src/runtime-env.js`,
		);
	});

	it("returns null for unrelated imports", () => {
		const plugin = createAstropressPackageResolverPlugin(packageRoot);
		expect(plugin.resolveId("./local-runtime-modules")).toBeNull();
		expect(plugin.resolveId("@astropress-diy/astropress")).toBeNull();
		expect(plugin.resolveId("astro")).toBeNull();
	});
});

describe("createAstropressLocalRuntimeModulePlugin — missing-alias guard", () => {
	it("throws a descriptive error when the runtime modules path is empty", () => {
		expect(() => createAstropressLocalRuntimeModulePlugin("")).toThrow(
			"[astropress] Missing Vite alias: 'local-runtime-modules'. " +
				"Add astropressIntegration() to your astro.config.mjs — " +
				"see https://astropress.diy/docs/quick-start#step-2-add-the-integration",
		);
	});
});

describe("normalizeRuntimeRequest — exercised via isAstropressLocalRuntimeModuleRequest", () => {
	// A localRuntimeModulesPath that does NOT contain the literal
	// "local-runtime-modules" so the hardcoded `.endsWith(...)` fallbacks cannot
	// match — every `true` result must flow through the path-equality branch,
	// making the normalization logic observable.
	const customPath = "/tmp/site/custom-modules.ts";

	it("normalizes backslash separators to forward slashes before comparing", () => {
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"\\tmp\\site\\custom-modules.ts",
				"/tmp/site/custom-modules.ts",
			),
		).toBe(true);
	});

	it("strips a file:// prefix before comparing", () => {
		expect(
			isAstropressLocalRuntimeModuleRequest("file:///tmp/site/custom-modules.ts", customPath),
		).toBe(true);
		// A non-file:// path that does not equal the target stays unmatched.
		expect(isAstropressLocalRuntimeModuleRequest("/tmp/site/other.ts", customPath)).toBe(false);
	});

	it("strips a two-slash file:// prefix as well as the three-slash form", () => {
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"file://tmp/site/custom-modules.ts",
				"/tmp/site/custom-modules.ts",
			),
		).toBe(true);
	});

	it("percent-decodes the path after stripping file://", () => {
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"file:///tmp/site%20space/custom-modules.ts",
				"/tmp/site space/custom-modules.ts",
			),
		).toBe(true);
	});

	it("does not throw on a malformed percent sequence in a non-file URL", () => {
		// The decodeURIComponent call lives behind the file:// guard; a bare
		// path containing an invalid `%` sequence must pass through untouched.
		expect(() =>
			isAstropressLocalRuntimeModuleRequest("ab%zz/custom-modules.ts", customPath),
		).not.toThrow();
		expect(isAstropressLocalRuntimeModuleRequest("ab%zz/custom-modules.ts", customPath)).toBe(
			false,
		);
	});

	it("slices the leading slash off a Windows drive-letter path", () => {
		// The id carries a leading-slash drive path (from file:// stripping); the
		// target has none. They only compare equal once the drive-letter slice
		// runs on the id — so the slice and its `/^\/[a-zA-Z]:\//` guard are both
		// observable here.
		expect(
			isAstropressLocalRuntimeModuleRequest(
				"file:///C:/site/custom-modules.ts",
				"C:/site/custom-modules.ts",
			),
		).toBe(true);
	});

	it("returns true via the path-equality branch even when no suffix matches", () => {
		expect(isAstropressLocalRuntimeModuleRequest(customPath, customPath)).toBe(true);
	});
});

describe("createAstropressViteAliases — find regexes and optional branches", () => {
	const localRuntimeModulesPath = "/tmp/site/src/astropress/local-runtime-modules.ts";

	it("emits exactly the two runtime-module aliases with their find regexes when no options are set", () => {
		const aliases = createAstropressViteAliases({ localRuntimeModulesPath });
		expect(aliases).toHaveLength(2);
		expect(aliases[0]).toEqual({
			find: /\/local-runtime-modules(?:\.[jt]s)?$/,
			replacement: localRuntimeModulesPath,
		});
		expect(aliases[1]).toEqual({
			find: /^\.\/local-runtime-modules(?:\.[jt]s)?$/,
			replacement: localRuntimeModulesPath,
		});
	});

	it("first find regex matches resolved runtime-module paths and rejects near-misses", () => {
		const [first] = createAstropressViteAliases({ localRuntimeModulesPath });
		const re = first.find as RegExp;
		expect(re.test("/x/local-runtime-modules")).toBe(true);
		expect(re.test("/x/local-runtime-modules.ts")).toBe(true);
		expect(re.test("/x/local-runtime-modules.js")).toBe(true);
		expect(re.test("/x/local-runtime-modules.css")).toBe(false);
		expect(re.test("/x/local-runtime-modules.ts.map")).toBe(false);
	});

	it("appends astropress package aliases only when astropressPackageRoot is provided", () => {
		const root = "/home/site/node_modules/@astropress-diy/astropress";
		const aliases = createAstropressViteAliases({
			localRuntimeModulesPath,
			astropressPackageRoot: root,
		});
		expect(aliases).toHaveLength(4);
		expect(aliases[2]).toEqual({ find: /^astropress\/(.+)$/, replacement: `${root}/$1` });
		expect(aliases[3]).toEqual({ find: /^astropress$/, replacement: root });
	});

	it("prepends the cloudflare:workers alias when a stub path is provided", () => {
		const aliases = createAstropressViteAliases({
			localRuntimeModulesPath,
			cloudflareWorkersStubPath: "/tmp/site/stub.ts",
		});
		expect(aliases[0]).toEqual({
			find: "cloudflare:workers",
			replacement: "/tmp/site/stub.ts",
		});
	});

	it("does not prepend a cloudflare alias when no stub path is provided", () => {
		const aliases = createAstropressViteAliases({ localRuntimeModulesPath });
		expect(aliases.some((a) => a.find === "cloudflare:workers")).toBe(false);
	});
});
