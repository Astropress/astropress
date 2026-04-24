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
		expect(upsertContentOverride).toHaveBeenCalled();
		expect(replaceContentAssignments).toHaveBeenCalledWith("about", {
			authorIds: [1, 2],
			categoryIds: [3],
			tagIds: [4],
		});
		expect(insertReviewedRevision).toHaveBeenCalled();
		expect(recordContentAudit).toHaveBeenCalledWith({
			actor,
			action: "content.update",
			summary: "Updated reviewed metadata for /about.",
			targetId: "about",
		});
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
			upsertContentOverride: vi.fn(),
			replaceContentAssignments: vi.fn(),
			insertReviewedRevision: vi.fn(),
			insertContentEntry,
			recordContentAudit: vi.fn(),
		});

		const result = repository.createContentRecord(
			{
				title: "New post",
				slug: " New Post ",
				status: "published",
				body: "<p>Body</p>",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
		);

		expect(insertContentEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "new-post",
				legacyUrl: "/new-post",
			}),
		);
		expect(result.ok).toBe(true);
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
			getPersistedRevision: () => revision,
			upsertContentOverride,
			replaceContentAssignments,
			insertReviewedRevision,
			insertContentEntry: vi.fn(),
			recordContentAudit: vi.fn(),
		});

		expect(repository.restoreRevision("about", "revision-1", actor)).toEqual({
			ok: true,
		});
		expect(upsertContentOverride).toHaveBeenCalled();
		expect(replaceContentAssignments).toHaveBeenCalledWith("about", {
			authorIds: [2],
			categoryIds: [3],
			tagIds: [4],
		});
		expect(insertReviewedRevision).toHaveBeenCalled();
	});
});
