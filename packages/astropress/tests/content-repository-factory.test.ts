import { describe, expect, it, vi } from "vitest";
import { createAstropressContentRepository } from "../src/content-repository-factory";
import type {
	Actor,
	ContentRecord,
	ContentRevision,
} from "../src/persistence-types";

const actor: Actor = {
	email: "admin@example.com",
	role: "admin",
	name: "Admin",
};

function baseRecord(overrides: Partial<ContentRecord> = {}): ContentRecord {
	return {
		slug: "about",
		legacyUrl: "/about",
		title: "About",
		templateKey: "content",
		sourceHtmlPath: "runtime://content/about",
		updatedAt: "2026-01-01T00:00:00.000Z",
		body: "<p>Original</p>",
		summary: "Original summary",
		status: "published",
		seoTitle: "About SEO",
		metaDescription: "About meta",
		...overrides,
	};
}

describe("createAstropressContentRepository", () => {
	it("lists content states in descending updated order and filters missing records", () => {
		const records = [
			baseRecord({
				slug: "older",
				legacyUrl: "/older",
				updatedAt: "2026-01-01T00:00:00.000Z",
			}),
			baseRecord({
				slug: "missing",
				legacyUrl: "/missing",
				updatedAt: "2026-01-03T00:00:00.000Z",
			}),
			baseRecord({
				slug: "newer",
				legacyUrl: "/newer",
				updatedAt: "2026-01-02T00:00:00.000Z",
			}),
		];
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "draft" ? "draft" : "published",
			findContentRecord: (slug) =>
				records.find((record) => record.slug === slug && slug !== "missing") ??
				null,
			listContentRecords: () => records,
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(repository.listContentStates().map((record) => record.slug)).toEqual(
			["newer", "older"],
		);
	});

	it("lists and maps content state with overrides and assignments", () => {
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "draft" ? "draft" : "published",
			findContentRecord: (slug) => (slug === "about" ? baseRecord() : null),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: () => ({
				title: "Edited",
				status: "draft",
				body: "<p>Edited</p>",
				seoTitle: "Edited SEO",
				metaDescription: "Edited meta",
			}),
			getContentAssignments: () => ({
				authorIds: [1],
				categoryIds: [2],
				tagIds: [3],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(repository.getContentState("about")).toMatchObject({
			title: "Edited",
			status: "draft",
			authorIds: [1],
			categoryIds: [2],
			tagIds: [3],
		});
	});

	it("saves content state through injected persistence hooks", () => {
		const upsertContentOverride = vi.fn();
		const replaceContentAssignments = vi.fn();
		const insertReviewedRevision = vi.fn();
		const recordContentAudit = vi.fn();
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "draft" ? "draft" : "published",
			findContentRecord: () => baseRecord(),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride,
			replaceContentAssignments,
			insertReviewedRevision,
			insertContentEntry: vi.fn(),
			recordContentAudit,
		});

		const result = repository.saveContentState(
			"about",
			{
				title: " Edited ",
				status: "draft",
				body: " <p>Body</p> ",
				authorIds: [1, 1, 2],
				categoryIds: [3],
				tagIds: [4],
				seoTitle: " SEO ",
				metaDescription: " Meta ",
			},
			actor,
		);

		expect(result.ok).toBe(true);
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"about",
			{
				title: "Edited",
				status: "draft",
				scheduledAt: undefined,
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: undefined,
				ogTitle: undefined,
				ogDescription: undefined,
				ogImage: undefined,
				canonicalUrlOverride: undefined,
				robotsDirective: undefined,
				metadata: undefined,
			},
			actor,
		);
		expect(replaceContentAssignments).toHaveBeenCalledWith("about", {
			authorIds: [1, 2],
			categoryIds: [3],
			tagIds: [4],
		});
		expect(insertReviewedRevision).toHaveBeenCalledWith(
			"about",
			{
				title: "Edited",
				status: "draft",
				scheduledAt: undefined,
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: undefined,
				ogTitle: undefined,
				ogDescription: undefined,
				ogImage: undefined,
				authorIds: [1, 2],
				categoryIds: [3],
				tagIds: [4],
				canonicalUrlOverride: undefined,
				robotsDirective: undefined,
				revisionNote: undefined,
			},
			actor,
		);
		expect(recordContentAudit).toHaveBeenCalledWith({
			actor,
			action: "content.update",
			summary: "Updated reviewed metadata for /about.",
			targetId: "about",
		});
	});

	it("saves trimmed seo fields, normalized schedule, metadata, and revision note", () => {
		const ensureBaselineRevision = vi.fn();
		const upsertContentOverride = vi.fn();
		const insertReviewedRevision = vi.fn();
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "review" ? "review" : "published",
			findContentRecord: () => baseRecord({ body: "<p>Existing body</p>" }),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision,
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride,
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision,
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		const result = repository.saveContentState(
			"about",
			{
				title: " Edited ",
				status: "review",
				scheduledAt: "2026-02-03T04:05:06.000Z",
				body: "  ",
				authorIds: [],
				categoryIds: [],
				tagIds: [],
				seoTitle: " SEO ",
				metaDescription: " Meta ",
				excerpt: " Summary excerpt ",
				ogTitle: " OG Title ",
				ogDescription: " OG Description ",
				ogImage: " https://cdn.example.com/og.png ",
				canonicalUrlOverride: " https://example.com/about ",
				robotsDirective: " noindex, nofollow ",
				revisionNote: " Saved after review ",
				metadata: { heroLayout: "split" },
				lastKnownUpdatedAt: "2026-01-01T00:00:00.000Z",
			},
			actor,
		);

		expect(result.ok).toBe(true);
		expect(ensureBaselineRevision).toHaveBeenCalledWith(
			baseRecord({ body: "<p>Existing body</p>" }),
		);
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"about",
			{
				title: "Edited",
				status: "review",
				scheduledAt: "2026-02-03T04:05:06.000Z",
				body: "<p>Existing body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: "Summary excerpt",
				ogTitle: "OG Title",
				ogDescription: "OG Description",
				ogImage: "https://cdn.example.com/og.png",
				canonicalUrlOverride: "https://example.com/about",
				robotsDirective: "noindex, nofollow",
				metadata: { heroLayout: "split" },
			},
			actor,
		);
		expect(insertReviewedRevision).toHaveBeenCalledWith(
			"about",
			{
				title: "Edited",
				status: "review",
				scheduledAt: "2026-02-03T04:05:06.000Z",
				body: "<p>Existing body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: "Summary excerpt",
				ogTitle: "OG Title",
				ogDescription: "OG Description",
				ogImage: "https://cdn.example.com/og.png",
				authorIds: [],
				categoryIds: [],
				tagIds: [],
				canonicalUrlOverride: "https://example.com/about",
				robotsDirective: "noindex, nofollow",
				revisionNote: "Saved after review",
			},
			actor,
		);
	});

	it("rejects a stale save when lastKnownUpdatedAt no longer matches", () => {
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "draft" ? "draft" : "published",
			findContentRecord: () =>
				baseRecord({ updatedAt: "2026-01-02T03:04:05.000Z" }),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		const result = repository.saveContentState(
			"about",
			{
				title: "Edited",
				status: "draft",
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				lastKnownUpdatedAt: "2026-01-01T00:00:00.000Z",
			},
			actor,
		);

		expect(result).toEqual({
			ok: false,
			error:
				"This record was modified by another editor after you opened it. Reload to see the latest version.",
			conflict: true,
		});
	});

	it("creates a new content record", () => {
		const insertContentEntry = vi.fn(() => true);
		const upsertContentOverride = vi.fn();
		const insertReviewedRevision = vi.fn();
		const recordContentAudit = vi.fn();
		const findContentRecord = vi
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(null)
			.mockImplementation((slug: string) =>
				slug === "new-post"
					? baseRecord({
							slug: "new-post",
							legacyUrl: "/new-post",
							title: "New post",
						})
					: null,
			);
		const repository = createAstropressContentRepository({
			normalizePath: (value) => (value.startsWith("/") ? value : `/${value}`),
			slugifyTerm: (value) => value.trim().toLowerCase().replace(/\s+/g, "-"),
			normalizeContentStatus: () => "published",
			findContentRecord,
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride,
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision,
			insertContentEntry,
			recordContentAudit,
		});

		const result = repository.createContentRecord(
			{
				title: " New post ",
				slug: " New Post ",
				legacyUrl: " /new-post ",
				status: "published",
				body: " <p>Body</p> ",
				summary: " Summary ",
				seoTitle: " SEO ",
				metaDescription: " Meta ",
				excerpt: " Excerpt ",
				ogTitle: " OG Title ",
				ogDescription: " OG Description ",
				ogImage: " https://cdn.example.com/og.png ",
				canonicalUrlOverride: " https://example.com/new-post ",
				robotsDirective: " noindex ",
			},
			actor,
		);

		expect(insertContentEntry).toHaveBeenCalledWith({
			slug: "new-post",
			legacyUrl: "/new-post",
			title: "New post",
			body: "<p>Body</p>",
			summary: "Summary",
			seoTitle: "SEO",
			metaDescription: "Meta",
			ogTitle: "OG Title",
			ogDescription: "OG Description",
			ogImage: "https://cdn.example.com/og.png",
		});
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"new-post",
			{
				title: "New post",
				status: "published",
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: "Excerpt",
				ogTitle: "OG Title",
				ogDescription: "OG Description",
				ogImage: "https://cdn.example.com/og.png",
				canonicalUrlOverride: "https://example.com/new-post",
				robotsDirective: "noindex",
			},
			actor,
		);
		expect(insertReviewedRevision).toHaveBeenCalledWith(
			"new-post",
			{
				title: "New post",
				status: "published",
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: "Excerpt",
				ogTitle: "OG Title",
				ogDescription: "OG Description",
				ogImage: "https://cdn.example.com/og.png",
				canonicalUrlOverride: "https://example.com/new-post",
				robotsDirective: "noindex",
				revisionNote: "Created new post.",
			},
			actor,
		);
		expect(recordContentAudit).toHaveBeenCalledWith({
			actor,
			action: "content.create",
			summary: "Created post /new-post.",
			targetId: "new-post",
		});
		expect(result.ok).toBe(true);
	});

	it("creates a new content record with summary fallback when excerpt is blank", () => {
		const upsertContentOverride = vi.fn();
		const insertReviewedRevision = vi.fn();
		const repository = createAstropressContentRepository({
			normalizePath: (value) => (value.startsWith("/") ? value : `/${value}`),
			slugifyTerm: (value) => value.trim().toLowerCase().replace(/\s+/g, "-"),
			normalizeContentStatus: () => "draft",
			findContentRecord: vi
				.fn()
				.mockReturnValueOnce(null)
				.mockReturnValueOnce(null)
				.mockImplementation((slug: string) =>
					slug === "summary-post"
						? baseRecord({
								slug: "summary-post",
								legacyUrl: "/summary-post",
								title: "Summary post",
							})
						: null,
				),
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride,
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision,
			insertContentEntry: vi.fn(() => true),
			recordContentAudit: vi.fn(),
		});

		const result = repository.createContentRecord(
			{
				title: "Summary post",
				slug: "summary-post",
				status: "draft",
				body: "<p>Body</p>",
				summary: "  Fallback summary  ",
				seoTitle: "Summary SEO",
				metaDescription: "Summary meta",
				excerpt: "   ",
			},
			actor,
		);

		expect(result.ok).toBe(true);
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"summary-post",
			expect.objectContaining({
				excerpt: "Fallback summary",
			}),
			actor,
		);
		expect(insertReviewedRevision).toHaveBeenCalledWith(
			"summary-post",
			expect.objectContaining({
				excerpt: "Fallback summary",
				revisionNote: "Created new post.",
			}),
			actor,
		);
	});

	it("creates a new content record with an empty summary when none is provided", () => {
		const insertContentEntry = vi.fn(() => true);
		const upsertContentOverride = vi.fn();
		const repository = createAstropressContentRepository({
			normalizePath: (value) => (value.startsWith("/") ? value : `/${value}`),
			slugifyTerm: (value) => value.trim().toLowerCase(),
			normalizeContentStatus: () => "draft",
			findContentRecord: vi
				.fn()
				.mockReturnValueOnce(null)
				.mockReturnValueOnce(null)
				.mockImplementation((slug: string) =>
					slug === "empty-summary"
						? baseRecord({
								slug: "empty-summary",
								legacyUrl: "/empty-summary",
								title: "Empty summary",
							})
						: null,
				),
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride,
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry,
			recordContentAudit: vi.fn(),
		});

		const result = repository.createContentRecord(
			{
				title: "Empty summary",
				slug: "empty-summary",
				status: "draft",
				body: "<p>Body</p>",
				seoTitle: "Empty summary SEO",
				metaDescription: "Empty summary meta",
			},
			actor,
		);

		expect(result.ok).toBe(true);
		expect(insertContentEntry).toHaveBeenCalledWith(
			expect.objectContaining({ summary: "" }),
		);
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"empty-summary",
			expect.objectContaining({ excerpt: undefined }),
			actor,
		);
	});

	it("rejects each missing save field with the required-fields error", () => {
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: (value) =>
				value === "draft" ? "draft" : "published",
			findContentRecord: () => baseRecord(),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(
			repository.saveContentState(
				"about",
				{
					title: "   ",
					status: "draft",
					body: "<p>Body</p>",
					seoTitle: "SEO",
					metaDescription: "Meta",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, SEO title, and meta description are required.",
		});
		expect(
			repository.saveContentState(
				"about",
				{
					title: "Title",
					status: "draft",
					body: "<p>Body</p>",
					seoTitle: "   ",
					metaDescription: "Meta",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, SEO title, and meta description are required.",
		});
		expect(
			repository.saveContentState(
				"about",
				{
					title: "Title",
					status: "draft",
					body: "<p>Body</p>",
					seoTitle: "SEO",
					metaDescription: "   ",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, SEO title, and meta description are required.",
		});
	});

	it("rejects each missing create field with the required-fields error", () => {
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value.trim(),
			normalizeContentStatus: () => "draft",
			findContentRecord: vi.fn(),
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(
			repository.createContentRecord(
				{
					title: "   ",
					slug: "valid-slug",
					status: "draft",
					seoTitle: "SEO",
					metaDescription: "Meta",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, slug, and meta description are required.",
		});
		expect(
			repository.createContentRecord(
				{
					title: "Title",
					slug: "   ",
					status: "draft",
					seoTitle: "SEO",
					metaDescription: "Meta",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, slug, and meta description are required.",
		});
		expect(
			repository.createContentRecord(
				{
					title: "Title",
					slug: "valid-slug",
					status: "draft",
					seoTitle: "SEO",
					metaDescription: "   ",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "Title, slug, and meta description are required.",
		});
	});

	it("rejects duplicate legacy routes and failed inserts for new records", () => {
		const duplicateLookup = vi
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(baseRecord({ slug: "about", legacyUrl: "/about" }));
		const duplicateRepository = createAstropressContentRepository({
			normalizePath: (value) => (value.startsWith("/") ? value : `/${value}`),
			slugifyTerm: (value) => value.trim().toLowerCase(),
			normalizeContentStatus: () => "draft",
			findContentRecord: duplicateLookup,
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(
			duplicateRepository.createContentRecord(
				{
					title: "About duplicate",
					slug: "new-slug",
					legacyUrl: " /about ",
					status: "draft",
					seoTitle: "About duplicate SEO",
					metaDescription: "About duplicate meta",
				},
				actor,
			),
		).toEqual({ ok: false, error: "That slug is already in use." });
		expect(duplicateLookup).toHaveBeenNthCalledWith(1, "new-slug");
		expect(duplicateLookup).toHaveBeenNthCalledWith(2, "about");

		const failedInsertRepository = createAstropressContentRepository({
			normalizePath: (value) => (value.startsWith("/") ? value : `/${value}`),
			slugifyTerm: (value) => value.trim().toLowerCase(),
			normalizeContentStatus: () => "draft",
			findContentRecord: vi.fn().mockReturnValue(null),
			listContentRecords: () => [],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: vi.fn(),
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(() => false),
			recordContentAudit: vi.fn(),
		});

		expect(
			failedInsertRepository.createContentRecord(
				{
					title: "Insert failure",
					slug: "insert-failure",
					status: "draft",
					seoTitle: "Insert failure SEO",
					metaDescription: "Insert failure meta",
				},
				actor,
			),
		).toEqual({
			ok: false,
			error: "That slug or route is already in use.",
		});
	});

	it("restores a persisted revision", () => {
		const revision: ContentRevision = {
			id: "revision-1",
			slug: "about",
			title: "Restored",
			status: "review",
			body: "<p>Restored</p>",
			authorIds: [2],
			categoryIds: [3],
			tagIds: [4],
			seoTitle: "Restored SEO",
			metaDescription: "Restored meta",
			source: "reviewed",
			createdAt: "2026-01-01T01:00:00.000Z",
		};
		const upsertContentOverride = vi.fn();
		const replaceContentAssignments = vi.fn();
		const insertReviewedRevision = vi.fn();
		const ensureBaselineRevision = vi.fn();
		const recordContentAudit = vi.fn();
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: () => "published",
			findContentRecord: () => baseRecord(),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision,
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: () => revision,
			upsertContentOverride,
			replaceContentAssignments,
			insertReviewedRevision,
			insertContentEntry: vi.fn(),
			recordContentAudit,
		});

		expect(repository.restoreRevision("about", "revision-1", actor)).toEqual({
			ok: true,
		});
		expect(ensureBaselineRevision).toHaveBeenCalledWith(baseRecord());
		expect(upsertContentOverride).toHaveBeenCalledWith(
			"about",
			{
				title: "Restored",
				status: "review",
				scheduledAt: undefined,
				body: "<p>Restored</p>",
				seoTitle: "Restored SEO",
				metaDescription: "Restored meta",
				excerpt: undefined,
				ogTitle: undefined,
				ogDescription: undefined,
				ogImage: undefined,
				canonicalUrlOverride: undefined,
				robotsDirective: undefined,
			},
			actor,
		);
		expect(replaceContentAssignments).toHaveBeenCalledWith("about", {
			authorIds: [2],
			categoryIds: [3],
			tagIds: [4],
		});
		expect(insertReviewedRevision).toHaveBeenCalledWith(
			"about",
			{
				title: "Restored",
				status: "review",
				scheduledAt: undefined,
				body: "<p>Restored</p>",
				seoTitle: "Restored SEO",
				metaDescription: "Restored meta",
				excerpt: undefined,
				ogTitle: undefined,
				ogDescription: undefined,
				ogImage: undefined,
				authorIds: [2],
				categoryIds: [3],
				tagIds: [4],
				canonicalUrlOverride: undefined,
				robotsDirective: undefined,
				revisionNote: undefined,
			},
			actor,
		);
		expect(recordContentAudit).toHaveBeenCalledWith({
			actor,
			action: "content.restore",
			summary: "Restored revision revision-1 for about.",
			targetId: "about",
		});
	});

	it("returns revision-not-found when the requested revision is missing", () => {
		const repository = createAstropressContentRepository({
			normalizePath: (value) => value,
			slugifyTerm: (value) => value,
			normalizeContentStatus: () => "published",
			findContentRecord: () => baseRecord(),
			listContentRecords: () => [baseRecord()],
			getPersistedOverride: vi.fn(),
			getContentAssignments: () => ({
				authorIds: [],
				categoryIds: [],
				tagIds: [],
			}),
			ensureBaselineRevision: vi.fn(),
			listPersistedRevisions: vi.fn(),
			getPersistedRevision: () => null,
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(
			repository.restoreRevision("about", "missing-revision", actor),
		).toEqual({
			ok: false,
			error: "Revision not found.",
		});
	});
});
