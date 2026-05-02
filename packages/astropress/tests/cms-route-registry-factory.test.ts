import { describe, expect, it, vi } from "vitest";
import { createAstropressCmsRouteRegistry } from "../src/cms-route-registry-factory";

const actor = {
	email: "admin@example.com",
	role: "admin" as const,
	name: "Admin",
};

describe("createAstropressCmsRouteRegistry", () => {
	it("saves a system route through injected persistence", () => {
		const persistSystemRoute = vi.fn();
		const appendSystemRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const registry = createAstropressCmsRouteRegistry({
			normalizePath: (pathname) =>
				pathname.startsWith("/") ? pathname : `/${pathname}`,
			localeFromPath: () => "en",
			listSystemRoutes: () => [],
			getSystemRoute: () => null,
			listStructuredPageRoutes: () => [],
			getStructuredPageRoute: () => null,
			getArchiveRoute: () => null,
			listArchiveRoutes: () => [],
			findSystemRouteForUpdate: () => ({
				id: "route-1",
				renderStrategy: "generated_text",
			}),
			persistSystemRoute,
			appendSystemRouteRevision,
			isRoutePathTaken: () => false,
			findStructuredRouteForUpdate: () => null,
			insertStructuredRoute: vi.fn(),
			persistStructuredRoute: vi.fn(),
			appendStructuredRouteRevision: vi.fn(),
			findArchiveRouteForUpdate: () => null,
			persistArchiveRoute: vi.fn(),
			appendArchiveRouteRevision: vi.fn(),
			recordRouteAudit,
		});

		const result = registry.saveSystemRoute(
			"/about",
			{ title: "About", summary: "Body" },
			actor,
		);
		expect(result.ok).toBe(true);
		expect(persistSystemRoute).toHaveBeenCalled();
		expect(appendSystemRouteRevision).toHaveBeenCalled();
		expect(recordRouteAudit).toHaveBeenCalled();
	});

	it("creates a structured page route", () => {
		const insertStructuredRoute = vi.fn();
		const appendStructuredRouteRevision = vi.fn();
		const registry = createAstropressCmsRouteRegistry({
			normalizePath: (pathname) =>
				pathname.startsWith("/") ? pathname : `/${pathname}`,
			localeFromPath: () => "en",
			listSystemRoutes: () => [],
			getSystemRoute: () => null,
			listStructuredPageRoutes: () => [],
			getStructuredPageRoute: () => ({
				path: "/programs",
				title: "Programs",
				templateKey: "content",
				alternateLinks: [],
				sections: null,
			}),
			getArchiveRoute: () => null,
			listArchiveRoutes: () => [],
			findSystemRouteForUpdate: () => null,
			persistSystemRoute: vi.fn(),
			appendSystemRouteRevision: vi.fn(),
			isRoutePathTaken: () => false,
			findStructuredRouteForUpdate: () => ({ id: "route-2" }),
			insertStructuredRoute,
			persistStructuredRoute: vi.fn(),
			appendStructuredRouteRevision,
			findArchiveRouteForUpdate: () => null,
			persistArchiveRoute: vi.fn(),
			appendArchiveRouteRevision: vi.fn(),
			recordRouteAudit: vi.fn(),
		});

		const result = registry.createStructuredPageRoute(
			"/programs",
			{ title: "Programs", templateKey: "content" },
			actor,
		);
		expect(result.ok).toBe(true);
		expect(insertStructuredRoute).toHaveBeenCalled();
		expect(appendStructuredRouteRevision).toHaveBeenCalled();
	});

	it("saves an archive route", () => {
		const persistArchiveRoute = vi.fn();
		const appendArchiveRouteRevision = vi.fn();
		const registry = createAstropressCmsRouteRegistry({
			normalizePath: (pathname) =>
				pathname.startsWith("/") ? pathname : `/${pathname}`,
			localeFromPath: () => "en",
			listSystemRoutes: () => [],
			getSystemRoute: () => null,
			listStructuredPageRoutes: () => [],
			getStructuredPageRoute: () => null,
			getArchiveRoute: () => ({ path: "/blog", title: "Blog" }),
			listArchiveRoutes: () => [],
			findSystemRouteForUpdate: () => null,
			persistSystemRoute: vi.fn(),
			appendSystemRouteRevision: vi.fn(),
			isRoutePathTaken: () => false,
			findStructuredRouteForUpdate: () => null,
			insertStructuredRoute: vi.fn(),
			persistStructuredRoute: vi.fn(),
			appendStructuredRouteRevision: vi.fn(),
			findArchiveRouteForUpdate: () => ({ id: "route-3" }),
			persistArchiveRoute,
			appendArchiveRouteRevision,
			recordRouteAudit: vi.fn(),
		});

		const result = registry.saveArchiveRoute("/blog", { title: "Blog" }, actor);
		expect(result.ok).toBe(true);
		expect(persistArchiveRoute).toHaveBeenCalled();
		expect(appendArchiveRouteRevision).toHaveBeenCalled();
	});

	function makeReadOnlyRegistry(overrides: Record<string, unknown> = {}) {
		const normalizePath = vi.fn(
			(p: string) => (p.startsWith("/") ? p : `/${p}`) as string,
		);
		const base = {
			normalizePath,
			localeFromPath: () => "en",
			listSystemRoutes: vi.fn(() => [{ path: "/about" }]),
			getSystemRoute: vi.fn(() => ({ path: "/about", title: "About" })),
			listStructuredPageRoutes: vi.fn(() => [{ path: "/programs" }]),
			getStructuredPageRoute: vi.fn(() => ({ path: "/programs" })),
			getArchiveRoute: vi.fn(() => ({ path: "/blog", title: "Blog" })),
			listArchiveRoutes: vi.fn(() => [{ path: "/blog" }]),
			findSystemRouteForUpdate: () => null,
			persistSystemRoute: vi.fn(),
			appendSystemRouteRevision: vi.fn(),
			isRoutePathTaken: () => false,
			findStructuredRouteForUpdate: () => null,
			insertStructuredRoute: vi.fn(),
			persistStructuredRoute: vi.fn(),
			appendStructuredRouteRevision: vi.fn(),
			findArchiveRouteForUpdate: () => null,
			persistArchiveRoute: vi.fn(),
			appendArchiveRouteRevision: vi.fn(),
			recordRouteAudit: vi.fn(),
			...overrides,
		} as never;
		return { input: base, registry: createAstropressCmsRouteRegistry(base) };
	}

	it("listSystemRoutes forwards to input.listSystemRoutes", () => {
		const { input, registry } = makeReadOnlyRegistry();
		expect(registry.listSystemRoutes()).toEqual([{ path: "/about" }]);
		expect(
			(input as { listSystemRoutes: ReturnType<typeof vi.fn> })
				.listSystemRoutes,
		).toHaveBeenCalled();
	});

	it("getSystemRoute normalizes the path before delegating", () => {
		const { input, registry } = makeReadOnlyRegistry();
		const result = registry.getSystemRoute("about");
		expect(result).toEqual({ path: "/about", title: "About" });
		const i = input as {
			normalizePath: ReturnType<typeof vi.fn>;
			getSystemRoute: ReturnType<typeof vi.fn>;
		};
		expect(i.normalizePath).toHaveBeenCalledWith("about");
		expect(i.getSystemRoute).toHaveBeenCalledWith("/about");
	});

	it("listStructuredPageRoutes forwards verbatim", () => {
		const { input, registry } = makeReadOnlyRegistry();
		expect(registry.listStructuredPageRoutes()).toEqual([
			{ path: "/programs" },
		]);
		expect(
			(input as { listStructuredPageRoutes: ReturnType<typeof vi.fn> })
				.listStructuredPageRoutes,
		).toHaveBeenCalled();
	});

	it("getStructuredPageRoute normalizes the path before delegating", () => {
		const { input, registry } = makeReadOnlyRegistry();
		expect(registry.getStructuredPageRoute("programs")).toEqual({
			path: "/programs",
		});
		const i = input as {
			normalizePath: ReturnType<typeof vi.fn>;
			getStructuredPageRoute: ReturnType<typeof vi.fn>;
		};
		expect(i.normalizePath).toHaveBeenCalledWith("programs");
		expect(i.getStructuredPageRoute).toHaveBeenCalledWith("/programs");
	});

	it("getArchiveRoute normalizes the path before delegating", () => {
		const { input, registry } = makeReadOnlyRegistry();
		expect(registry.getArchiveRoute("blog")).toEqual({
			path: "/blog",
			title: "Blog",
		});
		const i = input as {
			normalizePath: ReturnType<typeof vi.fn>;
			getArchiveRoute: ReturnType<typeof vi.fn>;
		};
		expect(i.normalizePath).toHaveBeenCalledWith("blog");
		expect(i.getArchiveRoute).toHaveBeenCalledWith("/blog");
	});

	it("listArchiveRoutes forwards verbatim", () => {
		const { input, registry } = makeReadOnlyRegistry();
		expect(registry.listArchiveRoutes()).toEqual([{ path: "/blog" }]);
		expect(
			(input as { listArchiveRoutes: ReturnType<typeof vi.fn> })
				.listArchiveRoutes,
		).toHaveBeenCalled();
	});

	it("saveStructuredPageRoute persists through doSaveStructuredPageRoute", () => {
		const persistStructuredRoute = vi.fn();
		const appendStructuredRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const { registry } = makeReadOnlyRegistry({
			findStructuredRouteForUpdate: () => ({ id: "route-x" }),
			persistStructuredRoute,
			appendStructuredRouteRevision,
			recordRouteAudit,
		});
		const result = registry.saveStructuredPageRoute(
			"/programs",
			{ title: "Programs", templateKey: "content" },
			actor,
		);
		expect(result.ok).toBe(true);
		expect(persistStructuredRoute).toHaveBeenCalled();
		expect(appendStructuredRouteRevision).toHaveBeenCalled();
	});
});
