/**
 * Section schema for the structured page editor.
 *
 * Sections are the unit of content for marketing / landing-style pages.
 * Each section has a kind discriminator and a per-kind shape. Sections
 * are persisted as JSON in cms_route_variants.sections_json and rendered
 * by per-kind Astro components on the public site.
 *
 * Types + scalar helpers live in `./schema-helpers`. Per-kind parsers
 * live in `./schema-parsers`. This file is the public API + dispatcher.
 */

import type { Section, SectionParseError, SectionsParseResult } from "./schema-helpers";
import { isNonEmptyString, isObject } from "./schema-helpers";
import {
	parseCtaBanner,
	parseFaq,
	parseFeatureGrid,
	parseGallery,
	parseHero,
	parseImageText,
	parseRichText,
	parseTestimonials,
} from "./schema-parsers";

export type {
	CtaBannerSection,
	CtaButton,
	CtaTone,
	FaqItem,
	FaqSection,
	FeatureGridSection,
	FeatureItem,
	GallerySection,
	GridColumns,
	HeroSection,
	ImageSide,
	ImageTextSection,
	RichTextSection,
	Section,
	SectionAlignment,
	SectionBase,
	SectionKind,
	SectionParseError,
	SectionsParseFailure,
	SectionsParseResult,
	SectionsParseSuccess,
	TestimonialLayout,
	TestimonialSource,
	TestimonialsSection,
} from "./schema-helpers";

export {
	isNonEmptyString,
	isObject,
	isOptionalString,
	isStringArray,
	parseAlignment,
	parseColumns,
	parseCtaButton,
	parseImageSide,
	parseTestimonialLayout,
	parseTestimonialSource,
	parseTone,
	SECTION_KINDS,
} from "./schema-helpers";

function parseSection(raw: unknown, path: string, errors: SectionParseError[]): Section | null {
	if (!isObject(raw)) {
		errors.push({ path, message: "section must be an object" });
		return null;
	}
	if (!isNonEmptyString(raw.id)) {
		errors.push({ path: `${path}.id`, message: "id is required" });
		return null;
	}
	const kind = raw.kind;
	switch (kind) {
		case "hero":
			return parseHero(raw, path, errors);
		case "feature-grid":
			return parseFeatureGrid(raw, path, errors);
		case "testimonials":
			return parseTestimonials(raw, path, errors);
		case "cta-banner":
			return parseCtaBanner(raw, path, errors);
		case "image-text":
			return parseImageText(raw, path, errors);
		case "faq":
			return parseFaq(raw, path, errors);
		case "gallery":
			return parseGallery(raw, path, errors);
		case "rich-text":
			return parseRichText(raw, path, errors);
		default:
			errors.push({
				path: `${path}.kind`,
				message: `unknown section kind: ${String(kind)}`,
			});
			return null;
	}
}

/**
 * Parse a sections payload. Accepts either an array of sections, a `{sections: [...]}` envelope,
 * or null/empty (returns []).
 */
export function parseSections(input: unknown): SectionsParseResult {
	const errors: SectionParseError[] = [];
	if (input == null) return { ok: true, sections: [] };
	let arr: unknown;
	if (Array.isArray(input)) {
		arr = input;
	} else if (isObject(input) && Array.isArray(input.sections)) {
		arr = input.sections;
	} else if (isObject(input) && Object.keys(input).length === 0) {
		return { ok: true, sections: [] };
	} else {
		return {
			ok: false,
			errors: [{ path: "$", message: "sections payload must be an array" }],
		};
	}
	const sections: Section[] = [];
	(arr as unknown[]).forEach((item, idx) => {
		const parsed = parseSection(item, `$[${idx}]`, errors);
		if (parsed) sections.push(parsed);
	});
	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, sections };
}

export function parseSectionsFromJson(json: string): SectionsParseResult {
	if (json.trim().length === 0) return { ok: true, sections: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch (err) {
		return {
			ok: false,
			errors: [
				{
					path: "$",
					message: `invalid JSON: ${(err as Error).message}`,
				},
			],
		};
	}
	return parseSections(parsed);
}
