import { describe, expect, it, vi } from "vitest";

vi.mock("../src/vite-runtime-alias", () => {
	return {
		createAstropressLocalRuntimeModulePlugin: vi.fn((path: string) => ({
			name: "local-runtime",
			__path: path,
		})),
		createAstropressPackageResolverPlugin: vi.fn((root: string) => ({
			name: "package-resolver",
			__root: root,
		})),
		createAstropressViteAliases: vi.fn((options) => [
			{ find: "alias", replacement: String(options?.localRuntimeModulesPath) },
		]),
	};
});

import { createAstropressViteIntegration } from "../src/vite-integration";
import {
	createAstropressLocalRuntimeModulePlugin,
	createAstropressPackageResolverPlugin,
	createAstropressViteAliases,
} from "../src/vite-runtime-alias";

describe("createAstropressViteIntegration", () => {
	it("returns the local-runtime plugin and aliases when astropressPackageRoot is unset", () => {
		const r = createAstropressViteIntegration({
			localRuntimeModulesPath: "/runtime.ts",
		} as never);
		expect(r.plugins).toHaveLength(1);
		expect((r.plugins[0] as { name: string }).name).toBe("local-runtime");
		expect((r.plugins[0] as { __path: string }).__path).toBe("/runtime.ts");
		expect(createAstropressLocalRuntimeModulePlugin).toHaveBeenCalledWith(
			"/runtime.ts",
		);
		expect(createAstropressPackageResolverPlugin).not.toHaveBeenCalled();
	});

	it("appends the package-resolver plugin when astropressPackageRoot is set", () => {
		const r = createAstropressViteIntegration({
			localRuntimeModulesPath: "/runtime.ts",
			astropressPackageRoot: "/pkg",
		} as never);
		expect(r.plugins).toHaveLength(2);
		expect((r.plugins[1] as { name: string }).name).toBe("package-resolver");
		expect((r.plugins[1] as { __root: string }).__root).toBe("/pkg");
		expect(createAstropressPackageResolverPlugin).toHaveBeenCalledWith("/pkg");
	});

	it("returns aliases produced by createAstropressViteAliases verbatim", () => {
		const r = createAstropressViteIntegration({
			localRuntimeModulesPath: "/x.ts",
		} as never);
		expect(r.aliases).toEqual([{ find: "alias", replacement: "/x.ts" }]);
		expect(createAstropressViteAliases).toHaveBeenCalledWith({
			localRuntimeModulesPath: "/x.ts",
		});
	});

	it("plugins array order: local-runtime first, package-resolver second", () => {
		const r = createAstropressViteIntegration({
			localRuntimeModulesPath: "/r.ts",
			astropressPackageRoot: "/pkg",
		} as never);
		expect((r.plugins[0] as { name: string }).name).toBe("local-runtime");
		expect((r.plugins[1] as { name: string }).name).toBe("package-resolver");
	});

	it("does not invoke package-resolver when astropressPackageRoot is empty string (falsy)", () => {
		// Pins ConditionalExpression on `if (options.astropressPackageRoot)`.
		(
			createAstropressPackageResolverPlugin as { mockClear?: () => void }
		).mockClear?.();
		const r = createAstropressViteIntegration({
			localRuntimeModulesPath: "/r.ts",
			astropressPackageRoot: "",
		} as never);
		expect(r.plugins).toHaveLength(1);
		expect(createAstropressPackageResolverPlugin).not.toHaveBeenCalled();
	});
});
