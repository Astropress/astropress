import { createContentRecordImpl, restoreRevisionImpl } from "./content-repository-factory-helpers";
import { mapContentState, normalizeAssignments } from "./content-repository-helpers";
import type { Actor, ContentRecord, ContentRepository, ContentRevision } from "./persistence-types";

export interface AstropressContentAssignments {
	authorIds: number[];
	categoryIds: number[];
	tagIds: number[];
}

export interface AstropressContentOverride {
	title: string;
	status: ContentRecord["status"];
	scheduledAt?: string;
	body?: string;
	seoTitle: string;
	metaDescription: string;
	excerpt?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	// audit-boundary: opaque-passthrough -- module-boundary value; narrowed at consumer
	metadata?: Record<string, unknown>;
}

export interface AstropressContentRepositoryInput {
	normalizePath(value: string): string;
	slugifyTerm(value: string): string;
	normalizeContentStatus(value?: string | null): ContentRecord["status"];
	findContentRecord(slug: string): ContentRecord | null | undefined;
	listContentRecords(): ContentRecord[];
	getPersistedOverride(slug: string): AstropressContentOverride | null | undefined;
	getContentAssignments(slug: string): AstropressContentAssignments;
	ensureBaselineRevision(record: ContentRecord): void;
	listPersistedRevisions(slug: string): ContentRevision[];
	getPersistedRevision(slug: string, revisionId: string): ContentRevision | null | undefined;
	upsertContentOverride(slug: string, override: AstropressContentOverride, actor: Actor): void;
	replaceContentAssignments(slug: string, assignments: AstropressContentAssignments): void;
	insertReviewedRevision(
		slug: string,
		revision: Omit<ContentRevision, "id" | "slug" | "source" | "createdAt" | "createdBy"> & {
			revisionNote?: string;
		},
		actor: Actor,
	): void;
	insertContentEntry(input: {
		slug: string;
		legacyUrl: string;
		title: string;
		body: string;
		summary: string;
		seoTitle: string;
		metaDescription: string;
		ogTitle?: string;
		ogDescription?: string;
		ogImage?: string;
	}): boolean;
	recordContentAudit(input: {
		actor: Actor;
		action: "content.create" | "content.update" | "content.restore";
		summary: string;
		targetId: string;
	}): void;
}

type SaveContentInput = Parameters<ContentRepository["saveContentState"]>[1] & {
	lastKnownUpdatedAt?: string;
};

function detectLocalConflict(record: ContentRecord, lastKnownUpdatedAt: string | undefined) {
	if (!lastKnownUpdatedAt) {
		return null;
	}

	if (record.updatedAt !== lastKnownUpdatedAt) {
		return {
			ok: false as const,
			error:
				"This record was modified by another editor after you opened it. Reload to see the latest version.",
			conflict: true as const,
		};
	}

	return null;
}

export function createAstropressContentRepository(
	input: AstropressContentRepositoryInput,
): ContentRepository {
	function getContentState(slug: string): ContentRecord | null {
		const record = input.findContentRecord(slug);
		if (!record) {
			return null;
		}

		return mapContentState(
			record,
			input.getPersistedOverride(record.slug),
			input.getContentAssignments(record.slug),
		);
	}

	return {
		listContentStates() {
			return input
				.listContentRecords()
				.map((record) => getContentState(record.slug))
				.filter((record): record is ContentRecord => Boolean(record))
				.sort(
					(left, right) => Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""),
				);
		},
		getContentState,
		getContentRevisions(slug) {
			const record = input.findContentRecord(slug);
			if (!record) {
				return null;
			}

			input.ensureBaselineRevision(record);
			return input.listPersistedRevisions(record.slug);
		},
		restoreRevision(slug, revisionId, actor) {
			return restoreRevisionImpl(input, slug, revisionId, actor);
		},
		saveContentState(slug, rawInput: SaveContentInput, actor) {
			const record = input.findContentRecord(slug);
			if (!record) {
				return {
					ok: false as const,
					error: "The selected content record could not be found.",
				};
			}

			const title = rawInput.title.trim();
			const seoTitle = rawInput.seoTitle.trim();
			const metaDescription = rawInput.metaDescription.trim();
			const status = input.normalizeContentStatus(rawInput.status);
			const body = rawInput.body?.trim() || record.body || "";
			const scheduledAt = rawInput.scheduledAt?.trim()
				? new Date(rawInput.scheduledAt).toISOString()
				: undefined;
			const revisionNote = rawInput.revisionNote?.trim() || undefined;

			if (!title || !seoTitle || !metaDescription) {
				return {
					ok: false as const,
					error: "Title, SEO title, and meta description are required.",
				};
			}

			const conflict = detectLocalConflict(record, rawInput.lastKnownUpdatedAt);
			if (conflict) {
				return conflict;
			}

			input.ensureBaselineRevision(record);
			const assignments = {
				authorIds: normalizeAssignments(rawInput.authorIds),
				categoryIds: normalizeAssignments(rawInput.categoryIds),
				tagIds: normalizeAssignments(rawInput.tagIds),
			};

			input.upsertContentOverride(
				record.slug,
				{
					title,
					status,
					scheduledAt,
					body,
					seoTitle,
					metaDescription,
					excerpt: rawInput.excerpt?.trim() || undefined,
					ogTitle: rawInput.ogTitle?.trim() || undefined,
					ogDescription: rawInput.ogDescription?.trim() || undefined,
					ogImage: rawInput.ogImage?.trim() || undefined,
					canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
					robotsDirective: rawInput.robotsDirective?.trim() || undefined,
					metadata: rawInput.metadata,
				},
				actor,
			);

			input.replaceContentAssignments(record.slug, assignments);
			input.insertReviewedRevision(
				record.slug,
				{
					title,
					status,
					scheduledAt,
					body,
					seoTitle,
					metaDescription,
					excerpt: rawInput.excerpt?.trim() || undefined,
					ogTitle: rawInput.ogTitle?.trim() || undefined,
					ogDescription: rawInput.ogDescription?.trim() || undefined,
					ogImage: rawInput.ogImage?.trim() || undefined,
					authorIds: assignments.authorIds,
					categoryIds: assignments.categoryIds,
					tagIds: assignments.tagIds,
					canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
					robotsDirective: rawInput.robotsDirective?.trim() || undefined,
					revisionNote,
				},
				actor,
			);

			input.recordContentAudit({
				actor,
				action: "content.update",
				summary: `Updated reviewed metadata for ${record.legacyUrl}.`,
				targetId: record.slug,
			});

			return { ok: true as const, state: getContentState(record.slug) };
		},
		createContentRecord(rawInput, actor) {
			return createContentRecordImpl(input, getContentState, rawInput, actor);
		},
	};
}
