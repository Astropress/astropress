// Direct unit tests for src/cms-route-registry-helpers.ts. The existing
// cms-route-registry-factory.test.ts exercises these helpers only through
// the factory and only asserts that the persist mocks were *called* — not
// what they were called *with*. Many MethodExpression mutants on `.trim()`
// and the `?? null` / `|| title` fallback chains survive because the test
// inputs are already trimmed and no assertion inspects the value flowing
// to persistence. This file fills that gap.
import { describe, expect, it, vi } from "vitest";

import type { AstropressCmsRouteRegistryFactoryInput } from "../src/cms-route-registry-helpers";
import {
	doCreateStructuredPageRoute,
	doSaveArchiveRoute,
	doSaveStructuredPageRoute,
	doSaveSystemRoute,
	normalizeArchiveInput,
	normalizeStructuredInput,
} from "../src/cms-route-registry-helpers";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

function makeCtx(
	overrides: Partial<AstropressCmsRouteRegistryFactoryInput> = {},
): AstropressCmsRouteRegistryFactoryInput {
	return {
		normalizePath: (p) => (p.startsWith("/") ? p : `/${p}`),
		localeFromPath: () => "en",
		listSystemRoutes: () => [],
		getSystemRoute: () => null,
		listStructuredPageRoutes: () => [],
		getStructuredPageRoute: () => null,
		getArchiveRoute: () => null,
		listArchiveRoutes: () => [],
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
	} as AstropressCmsRouteRegistryFactoryInput;
}

describe("normalizeStructuredInput", () => {
	it("trims every string field and applies the title→seoTitle→metaDescription fallback chain", () => {
		const f = normalizeStructuredInput({
			title: "  Title  ",
			summary: "  Summary  ",
			seoTitle: "  Custom SEO  ",
			metaDescription: "  Direct meta  ",
			canonicalUrlOverride: "  https://canonical/ ",
			robotsDirective: "  noindex  ",
			ogImage: "  /og.png  ",
			templateKey: "content",
			alternateLinks: [{ hreflang: "es", href: "/es/" }],
			sections: { foo: "bar" },
		});
		expect(f).toEqual({
			title: "Title",
			summary: "Summary",
			seoTitle: "Custom SEO",
			metaDescription: "Direct meta",
			canonicalUrlOverride: "https://canonical/",
			robotsDirective: "noindex",
			ogImage: "/og.png",
			alternateLinks: [{ hreflang: "es", href: "/es/" }],
			sections: { foo: "bar" },
		});
	});

	it("falls back seoTitle to title when seoTitle is empty after trimming", () => {
		const f = normalizeStructuredInput({
			title: "Hello",
			seoTitle: "   ",
			templateKey: "content",
		});
		expect(f.seoTitle).toBe("Hello");
	});

	it("falls back metaDescription via summary then title (kills the ?? || cascade)", () => {
		const onlySummary = normalizeStructuredInput({
			title: "Title",
			summary: "Summary text",
			metaDescription: "",
			templateKey: "content",
		});
		expect(onlySummary.metaDescription).toBe("Summary text");

		const noSummary = normalizeStructuredInput({
			title: "OnlyTitle",
			summary: "",
			metaDescription: "",
			templateKey: "content",
		});
		expect(noSummary.metaDescription).toBe("OnlyTitle");

		const direct = normalizeStructuredInput({
			title: "Title",
			summary: "Summary",
			metaDescription: "Direct",
			templateKey: "content",
		});
		expect(direct.metaDescription).toBe("Direct");
	});

	it("returns null for summary/canonical/robots/ogImage when they are blank or omitted", () => {
		const blank = normalizeStructuredInput({
			title: "T",
			summary: "   ",
			canonicalUrlOverride: "",
			robotsDirective: "",
			ogImage: "",
			templateKey: "content",
		});
		expect(blank.summary).toBeNull();
		expect(blank.canonicalUrlOverride).toBeNull();
		expect(blank.robotsDirective).toBeNull();
		expect(blank.ogImage).toBeNull();

		const omitted = normalizeStructuredInput({ title: "T", templateKey: "content" });
		expect(omitted.summary).toBeNull();
		expect(omitted.canonicalUrlOverride).toBeNull();
		expect(omitted.robotsDirective).toBeNull();
		expect(omitted.ogImage).toBeNull();
	});

	it("defaults alternateLinks to [] and sections to null when not provided (kills `?? []` and `?? null`)", () => {
		const f = normalizeStructuredInput({ title: "T", templateKey: "content" });
		expect(f.alternateLinks).toEqual([]);
		expect(f.sections).toBeNull();
	});

	it("preserves an explicitly empty alternateLinks array rather than collapsing it (kills `|| []` LogicalOperator)", () => {
		const f = normalizeStructuredInput({
			title: "T",
			templateKey: "content",
			alternateLinks: [],
		});
		expect(Array.isArray(f.alternateLinks)).toBe(true);
		expect(f.alternateLinks).toHaveLength(0);
	});
});

describe("normalizeArchiveInput", () => {
	it("trims every string field and applies the title→seoTitle fallback", () => {
		const f = normalizeArchiveInput({
			title: "  Blog  ",
			summary: "  s  ",
			seoTitle: "  custom  ",
			metaDescription: "  m  ",
			canonicalUrlOverride: "  c  ",
			robotsDirective: "  r  ",
		});
		expect(f).toEqual({
			title: "Blog",
			summary: "s",
			seoTitle: "custom",
			metaDescription: "m",
			canonicalUrlOverride: "c",
			robotsDirective: "r",
		});
	});

	it("falls back seoTitle to title and metaDescription to summary then '' (NOT title) — distinguishes archive's '' from structured's title fallback at line 83", () => {
		const f = normalizeArchiveInput({
			title: "Blog",
			summary: "",
			seoTitle: "   ",
			metaDescription: "   ",
		});
		expect(f.seoTitle).toBe("Blog");
		// Archive normalizer specifically uses '' (NOT title) as the final fallback
		expect(f.metaDescription).toBe("");

		const withSummary = normalizeArchiveInput({
			title: "Blog",
			summary: "Summary",
			metaDescription: "   ",
		});
		expect(withSummary.metaDescription).toBe("Summary");
	});

	it("returns null for summary/canonical/robots when they are blank", () => {
		const f = normalizeArchiveInput({ title: "T" });
		expect(f.summary).toBeNull();
		expect(f.canonicalUrlOverride).toBeNull();
		expect(f.robotsDirective).toBeNull();
	});
});

describe("doSaveSystemRoute", () => {
	it("rejects an empty normalized path with the documented error message", () => {
		const ctx = makeCtx({ normalizePath: () => "" });
		const result = doSaveSystemRoute(ctx, "anything", { title: "X" }, actor);
		expect(result).toEqual({ ok: false, error: "A system route path is required." });
	});

	it("rejects when the system route is not found", () => {
		const ctx = makeCtx({ findSystemRouteForUpdate: () => null });
		const result = doSaveSystemRoute(ctx, "/about", { title: "X" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "The selected system route could not be found.",
		});
	});

	it("rejects when the title trims to empty", () => {
		const ctx = makeCtx({
			findSystemRouteForUpdate: () => ({ id: "r-1", renderStrategy: "generated_text" }),
		});
		const result = doSaveSystemRoute(ctx, "/about", { title: "   " }, actor);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("persists with trimmed title/summary/bodyHtml and serialised settings JSON", () => {
		const persistSystemRoute = vi.fn();
		const appendSystemRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const ctx = makeCtx({
			findSystemRouteForUpdate: () => ({ id: "r-1", renderStrategy: "generated_text" }),
			persistSystemRoute,
			appendSystemRouteRevision,
			recordRouteAudit,
		});
		const result = doSaveSystemRoute(
			ctx,
			"/about",
			{
				title: "  About  ",
				summary: "  s  ",
				bodyHtml: "  <p>hi</p>  ",
				settings: { theme: "light" },
				revisionNote: "  note  ",
			},
			actor,
		);
		expect(result.ok).toBe(true);
		expect(persistSystemRoute).toHaveBeenCalledWith({
			routeId: "r-1",
			title: "About",
			summary: "s",
			bodyHtml: "<p>hi</p>",
			settingsJson: JSON.stringify({ theme: "light" }),
			actor,
		});
		expect(appendSystemRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				routeId: "r-1",
				title: "About",
				summary: "s",
				bodyHtml: "<p>hi</p>",
				settings: { theme: "light" },
				revisionNote: "note",
				renderStrategy: "generated_text",
			}),
		);
		expect(recordRouteAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "system.update",
				targetId: "/about",
				summary: "Updated system route /about.",
			}),
		);
		expect(result.ok && result.route).toEqual({
			path: "/about",
			title: "About",
			summary: "s",
			bodyHtml: "<p>hi</p>",
			settings: { theme: "light" },
			renderStrategy: "generated_text",
		});
	});

	it("nulls out summary/bodyHtml/settings/revisionNote when they are blank or omitted", () => {
		const persistSystemRoute = vi.fn();
		const appendSystemRouteRevision = vi.fn();
		const ctx = makeCtx({
			findSystemRouteForUpdate: () => ({ id: "r-1", renderStrategy: "generated_text" }),
			persistSystemRoute,
			appendSystemRouteRevision,
		});
		doSaveSystemRoute(ctx, "/about", { title: "About" }, actor);
		expect(persistSystemRoute).toHaveBeenCalledWith(
			expect.objectContaining({
				summary: null,
				bodyHtml: null,
				settingsJson: null,
			}),
		);
		expect(appendSystemRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				summary: null,
				bodyHtml: null,
				settings: null,
				revisionNote: null,
			}),
		);
	});
});

describe("doCreateStructuredPageRoute", () => {
	it("rejects an empty normalized path", () => {
		const ctx = makeCtx({ normalizePath: () => "" });
		const result = doCreateStructuredPageRoute(
			ctx,
			"x",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({ ok: false, error: "A public path is required." });
	});

	it("rejects when the normalized path is '/'", () => {
		const ctx = makeCtx({ normalizePath: () => "/" });
		const result = doCreateStructuredPageRoute(
			ctx,
			"/",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({ ok: false, error: "A public path is required." });
	});

	it("rejects when the path is already taken", () => {
		const ctx = makeCtx({ isRoutePathTaken: () => true });
		const result = doCreateStructuredPageRoute(
			ctx,
			"/programs",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({ ok: false, error: "That public path is already in use." });
	});

	it("rejects when the title trims to empty", () => {
		const ctx = makeCtx();
		const result = doCreateStructuredPageRoute(
			ctx,
			"/programs",
			{ title: "   ", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("rejects with the post-insert lookup message when either created or routeId is null", () => {
		// Case 1: created is null
		const ctxNoCreated = makeCtx({
			getStructuredPageRoute: () => null,
			findStructuredRouteForUpdate: () => ({ id: "r-1" }),
		});
		const r1 = doCreateStructuredPageRoute(
			ctxNoCreated,
			"/programs",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(r1).toEqual({ ok: false, error: "The route page could not be created." });

		// Case 2: routeId is null
		const ctxNoRouteId = makeCtx({
			getStructuredPageRoute: () => ({ path: "/programs" }),
			findStructuredRouteForUpdate: () => null,
		});
		const r2 = doCreateStructuredPageRoute(
			ctxNoRouteId,
			"/programs",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(r2).toEqual({ ok: false, error: "The route page could not be created." });
	});

	it("invokes insertStructuredRoute, appendStructuredRouteRevision, and recordRouteAudit with the normalized & trimmed payload", () => {
		const insertStructuredRoute = vi.fn();
		const appendStructuredRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const ctx = makeCtx({
			isRoutePathTaken: () => false,
			insertStructuredRoute,
			appendStructuredRouteRevision,
			recordRouteAudit,
			getStructuredPageRoute: () => ({ path: "/programs" }),
			findStructuredRouteForUpdate: () => ({ id: "r-7" }),
		});
		const result = doCreateStructuredPageRoute(
			ctx,
			"/programs",
			{
				title: "  Programs  ",
				summary: "  s  ",
				templateKey: "content",
				revisionNote: "  rev  ",
			},
			actor,
		);
		expect(result.ok).toBe(true);
		expect(insertStructuredRoute).toHaveBeenCalledWith(
			expect.objectContaining({
				pathname: "/programs",
				locale: "en",
				templateKey: "content",
				title: "Programs",
				summary: "s",
				actor,
			}),
		);
		expect(appendStructuredRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				routeId: "r-7",
				revisionNote: "rev",
			}),
		);
		expect(recordRouteAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "route_page.create",
				targetId: "/programs",
				summary: "Created route page /programs.",
			}),
		);
	});

	it("uses the default `Created route page.` revision note when revisionNote is blank", () => {
		const appendStructuredRouteRevision = vi.fn();
		const ctx = makeCtx({
			appendStructuredRouteRevision,
			getStructuredPageRoute: () => ({ path: "/programs" }),
			findStructuredRouteForUpdate: () => ({ id: "r-8" }),
		});
		doCreateStructuredPageRoute(ctx, "/programs", { title: "P", templateKey: "content" }, actor);
		expect(appendStructuredRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({ revisionNote: "Created route page." }),
		);
	});
});

describe("doSaveStructuredPageRoute", () => {
	it("rejects when the route is not found", () => {
		const ctx = makeCtx({ findStructuredRouteForUpdate: () => null });
		const result = doSaveStructuredPageRoute(
			ctx,
			"/programs",
			{ title: "T", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({
			ok: false,
			error: "The selected route page could not be found.",
		});
	});

	it("rejects when title trims to empty", () => {
		const ctx = makeCtx({ findStructuredRouteForUpdate: () => ({ id: "r-9" }) });
		const result = doSaveStructuredPageRoute(
			ctx,
			"/programs",
			{ title: "   ", templateKey: "content" },
			actor,
		);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("throws when post-save lookup returns null (kills the BlockStatement and string-literal mutants in `Route ${path} not found after save`)", () => {
		const ctx = makeCtx({
			findStructuredRouteForUpdate: () => ({ id: "r-10" }),
			getStructuredPageRoute: () => null,
		});
		expect(() =>
			doSaveStructuredPageRoute(ctx, "/programs", { title: "T", templateKey: "content" }, actor),
		).toThrow(/Route \/programs not found after save/);
	});

	it("persists with trimmed values and uses null revisionNote when omitted", () => {
		const persistStructuredRoute = vi.fn();
		const appendStructuredRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const ctx = makeCtx({
			findStructuredRouteForUpdate: () => ({ id: "r-11" }),
			getStructuredPageRoute: () => ({ path: "/programs" }),
			persistStructuredRoute,
			appendStructuredRouteRevision,
			recordRouteAudit,
		});
		const result = doSaveStructuredPageRoute(
			ctx,
			"/programs",
			{ title: "  Programs  ", templateKey: "content" },
			actor,
		);
		expect(result.ok).toBe(true);
		expect(persistStructuredRoute).toHaveBeenCalledWith(
			expect.objectContaining({ routeId: "r-11", title: "Programs" }),
		);
		expect(appendStructuredRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({ revisionNote: null }),
		);
		expect(recordRouteAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "route_page.update",
				targetId: "/programs",
				summary: "Updated route page /programs.",
			}),
		);
	});
});

describe("doSaveArchiveRoute", () => {
	it("rejects when the archive route is not found", () => {
		const ctx = makeCtx({ findArchiveRouteForUpdate: () => null });
		const result = doSaveArchiveRoute(ctx, "/blog", { title: "Blog" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "The selected archive route could not be found.",
		});
	});

	it("rejects when title trims to empty", () => {
		const ctx = makeCtx({ findArchiveRouteForUpdate: () => ({ id: "r-12" }) });
		const result = doSaveArchiveRoute(ctx, "/blog", { title: "   " }, actor);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("throws when the post-save lookup is null", () => {
		const ctx = makeCtx({
			findArchiveRouteForUpdate: () => ({ id: "r-13" }),
			getArchiveRoute: () => null,
		});
		expect(() => doSaveArchiveRoute(ctx, "/blog", { title: "B" }, actor)).toThrow(
			/Archive route \/blog not found after save/,
		);
	});

	it("persists with trimmed title and forwards normalized fields including null revisionNote", () => {
		const persistArchiveRoute = vi.fn();
		const appendArchiveRouteRevision = vi.fn();
		const recordRouteAudit = vi.fn();
		const ctx = makeCtx({
			findArchiveRouteForUpdate: () => ({ id: "r-14" }),
			getArchiveRoute: () => ({ path: "/blog", title: "Blog" }),
			persistArchiveRoute,
			appendArchiveRouteRevision,
			recordRouteAudit,
		});
		const result = doSaveArchiveRoute(ctx, "/blog", { title: "  Blog  ", summary: "  s  " }, actor);
		expect(result.ok).toBe(true);
		expect(persistArchiveRoute).toHaveBeenCalledWith(
			expect.objectContaining({
				routeId: "r-14",
				pathname: "/blog",
				title: "Blog",
				summary: "s",
				actor,
			}),
		);
		expect(appendArchiveRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				routeId: "r-14",
				pathname: "/blog",
				revisionNote: null,
				actor,
			}),
		);
		expect(recordRouteAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "archive.update",
				targetId: "/blog",
				summary: "Updated archive route /blog.",
			}),
		);
	});

	it("forwards a trimmed revisionNote when one is given", () => {
		const appendArchiveRouteRevision = vi.fn();
		const ctx = makeCtx({
			findArchiveRouteForUpdate: () => ({ id: "r-15" }),
			getArchiveRoute: () => ({ path: "/blog", title: "Blog" }),
			appendArchiveRouteRevision,
		});
		doSaveArchiveRoute(ctx, "/blog", { title: "B", revisionNote: "  rv  " }, actor);
		expect(appendArchiveRouteRevision).toHaveBeenCalledWith(
			expect.objectContaining({ revisionNote: "rv" }),
		);
	});
});
