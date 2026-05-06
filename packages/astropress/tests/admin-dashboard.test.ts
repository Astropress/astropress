import { describe, expect, it, vi } from "vitest";

import { buildAdminDashboardModel } from "../src/admin-dashboard";
import type { AuthUser } from "../src/platform-contracts";

type ContentRecord = Parameters<
	NonNullable<
		Parameters<typeof buildAdminDashboardModel>[3]["isSeededPostRecord"]
	>
>[0];

const ADMIN_USER: AuthUser = {
	id: "admin-1",
	email: "admin@example.com",
	isAdmin: true,
} as AuthUser;

const NON_ADMIN_USER: AuthUser = {
	id: "user-1",
	email: "user@example.com",
	isAdmin: false,
} as AuthUser;

const LOCALS = {} as Parameters<typeof buildAdminDashboardModel>[0];

function content(overrides: Partial<ContentRecord> = {}): ContentRecord {
	return {
		id: "id",
		kind: "post",
		slug: "slug",
		status: "published",
		title: "T",
		body: "",
		updatedAt: "2026-01-01T00:00:00.000Z",
		metadata: {},
		...overrides,
	} as ContentRecord;
}

function makeDeps(
	overrides: Partial<Parameters<typeof buildAdminDashboardModel>[3]> = {},
): Parameters<typeof buildAdminDashboardModel>[3] {
	return {
		getRuntimeAuditEvents: vi.fn(async () => []),
		getRuntimeComments: vi.fn(async () => []),
		getRuntimeRedirectRules: vi.fn(async () => []),
		getRuntimeTranslationState: vi.fn(async (_r, fallback) => fallback),
		listRuntimeContentStates: vi.fn(async () => []),
		listRuntimeStructuredPageRoutes: vi.fn(async () => []),
		listRuntimeSystemRoutes: vi.fn(async () => []),
		getRuntimeArchiveRoute: vi.fn(async () => null),
		isSeededPostRecord: vi.fn((r: ContentRecord) => r.kind === "post"),
		...overrides,
	};
}

describe("buildAdminDashboardModel — base shape", () => {
	it("returns every field in the model with sensible defaults when all sources are empty", async () => {
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[],
			makeDeps(),
		);
		expect(model).toMatchObject({
			auditEvents: [],
			comments: [],
			redirectRules: [],
			routePages: [],
			contentStates: [],
			systemRoutes: [],
			posts: [],
			pages: [],
			reviewPosts: [],
			scheduledPosts: [],
			recentAuditEvents: [],
			recentActivity: [],
			translationNeedsAttention: 0,
			seoNeedsAttention: 0,
			latestDeployment: null,
		});
		expect(model.archiveRoutes).toEqual([null, null, null]);
		expect(model.supportSurfaceLinks).toHaveLength(4);
	});

	it("invokes every getRuntime* dep exactly once", async () => {
		const deps = makeDeps();
		await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(deps.getRuntimeAuditEvents).toHaveBeenCalledTimes(1);
		expect(deps.getRuntimeComments).toHaveBeenCalledTimes(1);
		expect(deps.getRuntimeRedirectRules).toHaveBeenCalledTimes(1);
		expect(deps.listRuntimeContentStates).toHaveBeenCalledTimes(1);
		expect(deps.listRuntimeStructuredPageRoutes).toHaveBeenCalledTimes(1);
		expect(deps.listRuntimeSystemRoutes).toHaveBeenCalledTimes(1);
	});
});

describe("settledValue fallback", () => {
	it("substitutes [] when getRuntimeAuditEvents rejects", async () => {
		const deps = makeDeps({
			getRuntimeAuditEvents: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.auditEvents).toEqual([]);
		expect(model.recentAuditEvents).toEqual([]);
	});

	it("substitutes [] when listRuntimeContentStates rejects", async () => {
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.contentStates).toEqual([]);
		expect(model.posts).toEqual([]);
	});

	it("substitutes [] when getRuntimeComments rejects", async () => {
		const deps = makeDeps({
			getRuntimeComments: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.comments).toEqual([]);
	});

	it("substitutes [] when getRuntimeRedirectRules rejects", async () => {
		const deps = makeDeps({
			getRuntimeRedirectRules: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.redirectRules).toEqual([]);
	});

	it("substitutes [] when listRuntimeStructuredPageRoutes rejects", async () => {
		const deps = makeDeps({
			listRuntimeStructuredPageRoutes: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.routePages).toEqual([]);
	});

	it("substitutes [] when listRuntimeSystemRoutes rejects", async () => {
		const deps = makeDeps({
			listRuntimeSystemRoutes: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.systemRoutes).toEqual([]);
		expect(
			model.supportSurfaceLinks.find(
				(link) => link.labelKey === "dashboard.system",
			)?.count,
		).toBe(0);
	});

	it("substitutes [null, null, null] when archive lookups reject (admin)", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.archiveRoutes).toEqual([null, null, null]);
	});

	it("substitutes [] when translation lookups reject (admin)", async () => {
		const deps = makeDeps({
			getRuntimeTranslationState: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[{ route: "/a", translationState: "in_progress" }],
			deps,
		);
		expect(model.translationNeedsAttention).toBe(0);
	});
});

describe("isAdmin gating", () => {
	it("non-admin user gets empty translationEntries even when status entries exist", async () => {
		const deps = makeDeps({
			getRuntimeTranslationState: vi.fn(async () => "in_progress"),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			NON_ADMIN_USER,
			[{ route: "/about", translationState: "in_progress" }],
			deps,
		);
		expect(deps.getRuntimeTranslationState).not.toHaveBeenCalled();
		expect(model.translationNeedsAttention).toBe(0);
	});

	it("non-admin user gets empty archiveRoutes", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async () => ({ title: "X" })),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			NON_ADMIN_USER,
			[],
			deps,
		);
		expect(deps.getRuntimeArchiveRoute).not.toHaveBeenCalled();
		expect(model.archiveRoutes).toEqual([]);
	});

	it("undefined user is treated as non-admin", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async () => ({ title: "X" })),
		});
		const model = await buildAdminDashboardModel(LOCALS, undefined, [], deps);
		expect(deps.getRuntimeArchiveRoute).not.toHaveBeenCalled();
		expect(model.archiveRoutes).toEqual([]);
	});

	it("null user is treated as non-admin", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async () => ({ title: "X" })),
		});
		const model = await buildAdminDashboardModel(LOCALS, null, [], deps);
		expect(model.archiveRoutes).toEqual([]);
	});

	it("admin invokes getRuntimeArchiveRoute three times for /author, /category, /tag", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async (path: string) => ({
				title: `T-${path}`,
			})),
		});
		await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(deps.getRuntimeArchiveRoute).toHaveBeenCalledTimes(3);
		const calls = (
			deps.getRuntimeArchiveRoute as ReturnType<typeof vi.fn>
		).mock.calls.map((c) => c[0]);
		expect(calls).toEqual(["/author", "/category", "/tag"]);
	});
});

describe("posts/pages split", () => {
	it("splits records via isSeededPostRecord", async () => {
		const post = content({ id: "p1", slug: "p1", kind: "post" });
		const page = content({ id: "pg1", slug: "pg1", kind: "page" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [post, page]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.posts).toEqual([post]);
		expect(model.pages).toEqual([page]);
	});

	it("respects a custom isSeededPostRecord predicate (every record marked as page)", async () => {
		const a = content({ id: "a" });
		const b = content({ id: "b" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [a, b]),
			isSeededPostRecord: vi.fn(() => false),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.posts).toEqual([]);
		expect(model.pages).toEqual([a, b]);
	});
});

describe("reviewPosts", () => {
	it("includes posts with status 'review'", async () => {
		const r = content({ id: "r1", slug: "r1", status: "review" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [r]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.reviewPosts).toEqual([r]);
	});

	it("includes posts with status 'draft'", async () => {
		const d = content({ id: "d1", slug: "d1", status: "draft" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [d]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.reviewPosts).toEqual([d]);
	});

	it("excludes published posts", async () => {
		const p = content({ id: "p1", slug: "p1", status: "published" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [p]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.reviewPosts).toEqual([]);
	});

	it("treats missing status as 'published' (excluded from review)", async () => {
		const noStatus = content({
			id: "x",
			slug: "x",
			status: undefined as unknown as "published",
		});
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [noStatus]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.reviewPosts).toEqual([]);
	});

	it("only considers posts (not pages) for review", async () => {
		const reviewPage = content({
			id: "pg",
			slug: "pg",
			status: "review",
			kind: "page",
		});
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [reviewPage]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.reviewPosts).toEqual([]);
	});
});

describe("scheduledPosts", () => {
	const FUTURE = "2099-01-01T00:00:00.000Z";
	const PAST = "2000-01-01T00:00:00.000Z";

	it("includes future-scheduled posts only", async () => {
		const p = content({ id: "f1", slug: "f1", scheduledAt: FUTURE });
		const old = content({ id: "f2", slug: "f2", scheduledAt: PAST });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [p, old]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.scheduledPosts.map((r) => r.id)).toEqual(["f1"]);
	});

	it("excludes posts with no scheduledAt", async () => {
		const p = content({ id: "p1", slug: "p1" });
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [p]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.scheduledPosts).toEqual([]);
	});

	it("excludes posts with non-finite scheduledAt", async () => {
		const p = content({
			id: "p1",
			slug: "p1",
			scheduledAt: "not-a-date",
		});
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [p]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.scheduledPosts).toEqual([]);
	});

	it("sorts ascending by scheduledAt and slices to 5", async () => {
		const records = [
			"2099",
			"2098",
			"2100",
			"2097",
			"2101",
			"2096",
			"2102",
		].map((y, i) =>
			content({
				id: `s${i}`,
				slug: `s${i}`,
				scheduledAt: `${y}-01-01T00:00:00.000Z`,
			}),
		);
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => records),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.scheduledPosts.map((r) => r.scheduledAt)).toEqual([
			"2096-01-01T00:00:00.000Z",
			"2097-01-01T00:00:00.000Z",
			"2098-01-01T00:00:00.000Z",
			"2099-01-01T00:00:00.000Z",
			"2100-01-01T00:00:00.000Z",
		]);
	});
});

describe("recentAuditEvents and latestDeployment", () => {
	it("recentAuditEvents takes the first 6 audit events in order", async () => {
		const events = Array.from({ length: 10 }, (_, i) => ({
			id: `e${i}`,
			targetType: "content",
		})) as never[];
		const deps = makeDeps({
			getRuntimeAuditEvents: vi.fn(async () => events),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.recentAuditEvents).toHaveLength(6);
		expect((model.recentAuditEvents[0] as { id: string }).id).toBe("e0");
	});

	it("latestDeployment is the first event with targetType==='deployment'", async () => {
		const events = [
			{ id: "a", targetType: "content" },
			{ id: "b", targetType: "deployment" },
			{ id: "c", targetType: "deployment" },
		] as never[];
		const deps = makeDeps({
			getRuntimeAuditEvents: vi.fn(async () => events),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect((model.latestDeployment as { id: string } | null)?.id).toBe("b");
	});

	it("latestDeployment is null when no deployment event is present", async () => {
		const events = [{ id: "a", targetType: "content" }] as never[];
		const deps = makeDeps({
			getRuntimeAuditEvents: vi.fn(async () => events),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.latestDeployment).toBeNull();
	});
});

describe("recentActivity", () => {
	it("admin path: combines content + structured pages, sorts desc by updatedAt, slices to 6", async () => {
		const c1 = content({
			id: "c1",
			slug: "c1",
			updatedAt: "2026-03-01T00:00:00.000Z",
			title: "C1",
		});
		const c2 = content({
			id: "c2",
			slug: "c2",
			kind: "page",
			updatedAt: "2026-02-01T00:00:00.000Z",
			title: "C2",
		});
		const route1 = {
			path: "/route-1",
			title: "R1",
			updatedAt: "2026-04-01T00:00:00.000Z",
		};
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [c1, c2]),
			listRuntimeStructuredPageRoutes: vi.fn(async () => [route1]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.recentActivity.map((r) => r.title)).toEqual([
			"R1",
			"C1",
			"C2",
		]);
		expect(model.recentActivity[0].kind).toBe("Structured Page");
		expect(model.recentActivity[0].editHref).toBe(
			"/ap-admin/route-pages/route-1",
		);
		expect(model.recentActivity[1].editHref).toBe("/ap-admin/posts/c1");
		expect(model.recentActivity[1].kind).toBe("Post");
		expect(model.recentActivity[2].kind).toBe("Page");
	});

	it("non-admin path: only posts (no pages, no routes)", async () => {
		const post = content({
			id: "p1",
			slug: "p1",
			kind: "post",
			updatedAt: "2026-01-01T00:00:00.000Z",
			title: "P1",
		});
		const page = content({
			id: "pg1",
			slug: "pg1",
			kind: "page",
			updatedAt: "2026-02-01T00:00:00.000Z",
			title: "PG1",
		});
		const route1 = {
			path: "/r1",
			title: "R1",
			updatedAt: "2026-03-01T00:00:00.000Z",
		};
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [post, page]),
			listRuntimeStructuredPageRoutes: vi.fn(async () => [route1]),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			NON_ADMIN_USER,
			[],
			deps,
		);
		expect(model.recentActivity).toHaveLength(1);
		expect(model.recentActivity[0].title).toBe("P1");
	});

	it("filters out activity entries with no updatedAt", async () => {
		const noUpdate = content({
			id: "x",
			slug: "x",
			updatedAt: undefined,
			title: "X",
		});
		const yes = content({
			id: "y",
			slug: "y",
			updatedAt: "2026-01-01T00:00:00.000Z",
			title: "Y",
		});
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [noUpdate, yes]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.recentActivity.map((r) => r.title)).toEqual(["Y"]);
	});

	it("slices to at most 6 entries", async () => {
		const records = Array.from({ length: 10 }, (_, i) =>
			content({
				id: `r${i}`,
				slug: `r${i}`,
				updatedAt: `2026-01-${String(10 - i).padStart(2, "0")}T00:00:00.000Z`,
				title: `R${i}`,
			}),
		);
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => records),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.recentActivity).toHaveLength(6);
	});
});

describe("translationNeedsAttention", () => {
	it("counts non-published states for admin", async () => {
		const deps = makeDeps({
			getRuntimeTranslationState: vi.fn(async (route: string) =>
				route === "/a" ? "in_progress" : "published",
			),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[
				{ route: "/a", translationState: "in_progress" },
				{ route: "/b", translationState: "published" },
			],
			deps,
		);
		expect(model.translationNeedsAttention).toBe(1);
	});

	it("counts zero when every state is published", async () => {
		const deps = makeDeps({
			getRuntimeTranslationState: vi.fn(async () => "published"),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[
				{ route: "/a", translationState: "in_progress" },
				{ route: "/b", translationState: "published" },
			],
			deps,
		);
		expect(model.translationNeedsAttention).toBe(0);
	});

	it("forwards the entry's translationState as the fallback", async () => {
		const fallbackSpy = vi.fn(async (_r: string, fallback: string) => fallback);
		const deps = makeDeps({
			getRuntimeTranslationState: fallbackSpy,
		});
		await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[{ route: "/x", translationState: "in_progress" }],
			deps,
		);
		expect(fallbackSpy).toHaveBeenCalledWith("/x", "in_progress", LOCALS);
	});
});

describe("seoNeedsAttention", () => {
	it("counts contentStates missing seoTitle", async () => {
		const noTitle = content({
			id: "a",
			slug: "a",
			metadata: { seoTitle: undefined, metaDescription: "x" } as never,
		});
		(noTitle as { seoTitle?: string }).seoTitle = undefined;
		(noTitle as { metaDescription?: string }).metaDescription = "x";
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [noTitle]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.seoNeedsAttention).toBe(1);
	});

	it("counts routePages missing metaDescription", async () => {
		const route = {
			path: "/r1",
			title: "R1",
			updatedAt: "2026-01-01T00:00:00.000Z",
			seoTitle: "X",
			metaDescription: undefined,
		};
		const deps = makeDeps({
			listRuntimeStructuredPageRoutes: vi.fn(async () => [route]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.seoNeedsAttention).toBe(1);
	});

	it("counts zero when every record has both fields", async () => {
		const fullContent = content({
			id: "a",
			slug: "a",
		});
		(fullContent as { seoTitle?: string }).seoTitle = "T";
		(fullContent as { metaDescription?: string }).metaDescription = "D";
		const fullRoute = {
			path: "/r",
			title: "R",
			updatedAt: "2026-01-01T00:00:00.000Z",
			seoTitle: "T",
			metaDescription: "D",
		};
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [fullContent]),
			listRuntimeStructuredPageRoutes: vi.fn(async () => [fullRoute]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.seoNeedsAttention).toBe(0);
	});

	it("sums missing fields across both contentStates and routePages", async () => {
		const noSeo = content({ id: "a", slug: "a" });
		(noSeo as { seoTitle?: string }).seoTitle = undefined;
		(noSeo as { metaDescription?: string }).metaDescription = undefined;
		const noDescRoute = {
			path: "/r",
			title: "R",
			updatedAt: "2026-01-01T00:00:00.000Z",
			seoTitle: "T",
			metaDescription: undefined,
		};
		const deps = makeDeps({
			listRuntimeContentStates: vi.fn(async () => [noSeo]),
			listRuntimeStructuredPageRoutes: vi.fn(async () => [noDescRoute]),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(model.seoNeedsAttention).toBe(2);
	});
});

describe("supportSurfaceLinks", () => {
	it("emits four entries with the expected labelKeys and hrefs", async () => {
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[],
			makeDeps(),
		);
		expect(model.supportSurfaceLinks.map((l) => l.labelKey)).toEqual([
			"dashboard.translations",
			"dashboard.seo",
			"dashboard.archives",
			"dashboard.system",
		]);
		expect(model.supportSurfaceLinks.map((l) => l.href)).toEqual([
			"/ap-admin/translations",
			"/ap-admin/seo?missing=1",
			"/ap-admin/archives",
			"/ap-admin/system",
		]);
		expect(model.supportSurfaceLinks.map((l) => l.helperKey)).toEqual([
			"dashboard.translationsDesc",
			"dashboard.seoDesc",
			"dashboard.archivesDesc",
			"dashboard.systemDesc",
		]);
	});

	it("translations count reflects translationNeedsAttention", async () => {
		const deps = makeDeps({
			getRuntimeTranslationState: vi.fn(async () => "in_progress"),
		});
		const model = await buildAdminDashboardModel(
			LOCALS,
			ADMIN_USER,
			[
				{ route: "/a", translationState: "in_progress" },
				{ route: "/b", translationState: "in_progress" },
			],
			deps,
		);
		const translations = model.supportSurfaceLinks.find(
			(l) => l.labelKey === "dashboard.translations",
		);
		expect(translations?.count).toBe(2);
	});

	it("archives count reflects truthy archiveRoutes", async () => {
		const deps = makeDeps({
			getRuntimeArchiveRoute: vi.fn(async (path: string) =>
				path === "/author" ? null : { title: `${path}-archive` },
			),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		const archives = model.supportSurfaceLinks.find(
			(l) => l.labelKey === "dashboard.archives",
		);
		// 2 truthy archive routes (/category, /tag).
		expect(archives?.count).toBe(2);
	});

	it("system count reflects systemRoutes length", async () => {
		const sys = [
			{ path: "/a", title: "A" },
			{ path: "/b", title: "B" },
			{ path: "/c", title: "C" },
		];
		const deps = makeDeps({
			listRuntimeSystemRoutes: vi.fn(async () => sys),
		});
		const model = await buildAdminDashboardModel(LOCALS, ADMIN_USER, [], deps);
		expect(
			model.supportSurfaceLinks.find((l) => l.labelKey === "dashboard.system")
				?.count,
		).toBe(3);
	});
});
