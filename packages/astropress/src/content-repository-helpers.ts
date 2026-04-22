import type {
	AstropressContentAssignments,
	AstropressContentOverride,
} from "./content-repository-factory";
import type { ContentRecord } from "./persistence-types";

export function normalizeAssignments(values?: number[]): number[] {
	return [
		...new Set(
			(values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0),
		),
	];
}

export function mapContentState(
	record: ContentRecord,
	override: AstropressContentOverride | null | undefined,
	assignments: AstropressContentAssignments,
): ContentRecord {
	return {
		...record,
		title: override?.title ?? record.title,
		status: override?.status ?? record.status,
		scheduledAt: override?.scheduledAt,
		body: override?.body ?? record.body,
		authorIds: assignments.authorIds,
		categoryIds: assignments.categoryIds,
		tagIds: assignments.tagIds,
		seoTitle: override?.seoTitle ?? record.seoTitle,
		metaDescription: override?.metaDescription ?? record.metaDescription,
		excerpt: override?.excerpt ?? record.excerpt,
		ogTitle: override?.ogTitle,
		ogDescription: override?.ogDescription,
		ogImage: override?.ogImage,
		canonicalUrlOverride: override?.canonicalUrlOverride,
		robotsDirective: override?.robotsDirective,
	};
}
