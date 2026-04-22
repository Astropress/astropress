export interface SeededContentRecordLike {
	kind?: string | null;
	templateKey?: string | null;
	legacyUrl?: string | null;
}

export type SeededAdminContentType = "page" | "post";

export function getSeededAdminContentType(
	record: SeededContentRecordLike,
): SeededAdminContentType {
	if (
		record.kind === "post" ||
		record.templateKey === "post" ||
		record.templateKey === "content"
	) {
		return "post";
	}

	return "page";
}

export function isSeededPostRecord(record: SeededContentRecordLike) {
	return getSeededAdminContentType(record) === "post";
}

export function isSeededPageRecord(record: SeededContentRecordLike) {
	return getSeededAdminContentType(record) === "page";
}
