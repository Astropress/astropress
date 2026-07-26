import type { SectionParseError } from "./schema-helpers";

/**
 * Operator-facing labels for section kinds, shared by the client editor and the
 * server save action so their error messages can't drift.
 */
export const SECTION_KIND_LABELS: Record<string, string> = {
	hero: "Hero",
	"feature-grid": "Feature grid",
	testimonials: "Testimonials",
	"cta-banner": "Call-to-action",
	"image-text": "Image + text",
	faq: "FAQ",
	gallery: "Gallery",
	"rich-text": "Rich text",
};

/**
 * Turns a parser error path like `$[1].heading` into an operator-facing message
 * that names the offending section by position + kind, e.g.
 * "Section 2 (Image + text): heading — heading required" — instead of a raw JSON
 * path. `sections` is only used to resolve the kind label for the error index.
 */
export function humanizeSectionError(
	sections: ReadonlyArray<{ kind?: string } | null | undefined>,
	error: SectionParseError,
): string {
	// One regex for both the index and the field prefix: capture `$[<n>].`,
	// then slice it off for the field. Parsing the prefix twice let a dropped
	// anchor on the second regex survive undetected (it could never disagree
	// with the first).
	const indexMatch = error.path.match(/^\$\[(\d+)\]\.?/);
	if (!indexMatch) {
		return `Please fix the page sections: ${error.message}`;
	}
	const index = Number(indexMatch[1]);
	const kind = sections[index]?.kind;
	const kindLabel = (kind && SECTION_KIND_LABELS[kind]) || `section ${index + 1}`;
	const field = error.path.slice(indexMatch[0].length).trim();
	const where = field ? `${field} — ` : "";
	return `Section ${index + 1} (${kindLabel}): ${where}${error.message}`;
}

/** The 0-based section index an error points at, or -1 for a top-level error. */
export function sectionErrorIndex(error: SectionParseError): number {
	const indexMatch = error.path.match(/^\$\[(\d+)\]/);
	return indexMatch ? Number(indexMatch[1]) : -1;
}
