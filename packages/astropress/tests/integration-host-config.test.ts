import { describe, expect, it } from "vitest";
import { astropressHostViteConfig, resolvePackageRoot } from "../src/integration-host-config";

describe("resolvePackageRoot", () => {
	it("walks up one level from a src/ layout", () => {
		expect(resolvePackageRoot("file:///x/pkg/src/integration-host-config.js")).toBe("/x/pkg");
	});

	it("walks up two levels from a published dist/src/ layout", () => {
		// The `dist` segment must be detected and stripped; without it the root
		// would wrongly point inside dist.
		expect(resolvePackageRoot("file:///x/pkg/dist/src/integration-host-config.js")).toBe("/x/pkg");
	});
});

describe("astropressHostViteConfig", () => {
	const cfg = astropressHostViteConfig("/pkg/root");
	const [subpathAlias, bareAlias] = cfg.resolve.alias;

	it("rewrites subpath astropress imports to the scoped package", () => {
		expect("astropress/integration".replace(subpathAlias.find, subpathAlias.replacement)).toBe(
			"@astropress-diy/astropress/integration",
		);
		expect("astropress/a/b/c".replace(subpathAlias.find, subpathAlias.replacement)).toBe(
			"@astropress-diy/astropress/a/b/c",
		);
	});

	it("only rewrites subpaths anchored at the start of the specifier", () => {
		expect(subpathAlias.find.test("not-astropress/x")).toBe(false);
	});

	it("rewrites only the exact bare `astropress` specifier", () => {
		expect(bareAlias.find.test("astropress")).toBe(true);
		// $ anchor: a longer specifier that merely starts with astropress is left alone.
		expect(bareAlias.find.test("astropressible")).toBe(false);
		// ^ anchor: a specifier that merely ends with astropress is left alone.
		expect(bareAlias.find.test("x-astropress")).toBe(false);
		expect("astropress".replace(bareAlias.find, bareAlias.replacement)).toBe(
			"@astropress-diy/astropress",
		);
	});

	it("marks the package (and its bare self-import) non-external for SSR", () => {
		expect(cfg.ssr.noExternal).toEqual(["@astropress-diy/astropress", "astropress"]);
	});

	it("allows the dev server to read the package root", () => {
		expect(cfg.server.fs.allow).toEqual(["/pkg/root"]);
	});
});
