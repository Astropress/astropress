// Helpers extracted from content-repository-factory to keep that file
// under the 400-line arch-lint warning.

import type { AstropressContentRepositoryInput } from "./content-repository-factory";
import type { Actor, ContentRecord, ContentRepository } from "./persistence-types";

type CreateInput = Parameters<ContentRepository["createContentRecord"]>[0];
type RestoreResult = ReturnType<ContentRepository["restoreRevision"]>;
type CreateResult = ReturnType<ContentRepository["createContentRecord"]>;

export function restoreRevisionImpl(
	input: AstropressContentRepositoryInput,
	slug: string,
	revisionId: string,
	actor: Actor,
): RestoreResult {
	const record = input.findContentRecord(slug);
	if (!record) {
		return {
			ok: false as const,
			error: "The selected content record could not be found.",
		};
	}

	input.ensureBaselineRevision(record);
	const revision = input.getPersistedRevision(record.slug, revisionId);
	if (!revision) {
		return { ok: false as const, error: "Revision not found." };
	}

	input.upsertContentOverride(
		record.slug,
		{
			title: revision.title,
			status: revision.status,
			scheduledAt: revision.scheduledAt,
			body: revision.body,
			seoTitle: revision.seoTitle,
			metaDescription: revision.metaDescription,
			excerpt: revision.excerpt,
			ogTitle: revision.ogTitle,
			ogDescription: revision.ogDescription,
			ogImage: revision.ogImage,
			canonicalUrlOverride: revision.canonicalUrlOverride,
			robotsDirective: revision.robotsDirective,
		},
		actor,
	);

	input.replaceContentAssignments(record.slug, {
		authorIds: revision.authorIds ?? [],
		categoryIds: revision.categoryIds ?? [],
		tagIds: revision.tagIds ?? [],
	});

	input.insertReviewedRevision(
		record.slug,
		{
			title: revision.title,
			status: revision.status,
			scheduledAt: revision.scheduledAt,
			body: revision.body,
			seoTitle: revision.seoTitle,
			metaDescription: revision.metaDescription,
			excerpt: revision.excerpt,
			ogTitle: revision.ogTitle,
			ogDescription: revision.ogDescription,
			ogImage: revision.ogImage,
			authorIds: revision.authorIds,
			categoryIds: revision.categoryIds,
			tagIds: revision.tagIds,
			canonicalUrlOverride: revision.canonicalUrlOverride,
			robotsDirective: revision.robotsDirective,
			revisionNote: revision.revisionNote,
		},
		actor,
	);

	input.recordContentAudit({
		actor,
		action: "content.restore",
		summary: `Restored revision ${revisionId} for ${slug}.`,
		targetId: record.slug,
	});

	return { ok: true as const };
}

export function createContentRecordImpl(
	input: AstropressContentRepositoryInput,
	getContentState: (slug: string) => ContentRecord | null,
	rawInput: CreateInput,
	actor: Actor,
): CreateResult {
	const title = rawInput.title.trim();
	const slug = input.slugifyTerm(rawInput.slug);
	const legacyUrl = input.normalizePath(rawInput.legacyUrl?.trim() || `/${slug}`);
	const seoTitle = rawInput.seoTitle.trim() || title;
	const metaDescription = rawInput.metaDescription.trim();
	const status = input.normalizeContentStatus(rawInput.status);
	const body = rawInput.body?.trim() || "";
	const summary = rawInput.summary?.trim() || "";

	if (!title || !slug || !metaDescription) {
		return {
			ok: false as const,
			error: "Title, slug, and meta description are required.",
		};
	}

	if (input.findContentRecord(slug) || input.findContentRecord(legacyUrl.replace(/^\//, ""))) {
		return { ok: false as const, error: "That slug is already in use." };
	}

	const inserted = input.insertContentEntry({
		slug,
		legacyUrl,
		title,
		body,
		summary,
		seoTitle,
		metaDescription,
		ogTitle: rawInput.ogTitle?.trim() || undefined,
		ogDescription: rawInput.ogDescription?.trim() || undefined,
		ogImage: rawInput.ogImage?.trim() || undefined,
	});
	if (!inserted) {
		return {
			ok: false as const,
			error: "That slug or route is already in use.",
		};
	}

	input.upsertContentOverride(
		slug,
		{
			title,
			status,
			body,
			seoTitle,
			metaDescription,
			excerpt: rawInput.excerpt?.trim() || summary || undefined,
			ogTitle: rawInput.ogTitle?.trim() || undefined,
			ogDescription: rawInput.ogDescription?.trim() || undefined,
			ogImage: rawInput.ogImage?.trim() || undefined,
			canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
			robotsDirective: rawInput.robotsDirective?.trim() || undefined,
		},
		actor,
	);

	input.insertReviewedRevision(
		slug,
		{
			title,
			status,
			body,
			seoTitle,
			metaDescription,
			excerpt: rawInput.excerpt?.trim() || summary || undefined,
			ogTitle: rawInput.ogTitle?.trim() || undefined,
			ogDescription: rawInput.ogDescription?.trim() || undefined,
			ogImage: rawInput.ogImage?.trim() || undefined,
			canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
			robotsDirective: rawInput.robotsDirective?.trim() || undefined,
			revisionNote: "Created new post.",
		},
		actor,
	);

	input.recordContentAudit({
		actor,
		action: "content.create",
		summary: `Created post ${legacyUrl}.`,
		targetId: slug,
	});

	return { ok: true as const, state: getContentState(slug) };
}
