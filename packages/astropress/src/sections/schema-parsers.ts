// Per-kind section parsers. Extracted from schema.ts to keep that file
// under the 400-line arch-lint warning. The dispatcher (parseSection)
// and public API (parseSections) live in schema.ts.

import type {
	CtaBannerSection,
	FaqItem,
	FaqSection,
	FeatureGridSection,
	FeatureItem,
	GallerySection,
	HeroSection,
	ImageTextSection,
	RichTextSection,
	SectionParseError,
	TestimonialsSection,
} from "./schema-helpers";
import {
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
} from "./schema-helpers";

export function parseHero(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): HeroSection | null {
	if (!isNonEmptyString(raw.headline)) {
		errors.push({ path: `${path}.headline`, message: "headline is required" });
		return null;
	}
	if (!isOptionalString(raw.subhead)) {
		errors.push({ path: `${path}.subhead`, message: "subhead must be string" });
		return null;
	}
	if (!isOptionalString(raw.mediaId)) {
		errors.push({ path: `${path}.mediaId`, message: "mediaId must be string" });
		return null;
	}
	const out: HeroSection = {
		id: String(raw.id),
		kind: "hero",
		headline: raw.headline,
		alignment: parseAlignment(raw.alignment),
	};
	if (raw.subhead) out.subhead = raw.subhead;
	if (raw.mediaId) out.mediaId = raw.mediaId;
	if (raw.primaryCta !== undefined) {
		const cta = parseCtaButton(raw.primaryCta, `${path}.primaryCta`, errors);
		if (cta) out.primaryCta = cta;
	}
	if (raw.secondaryCta !== undefined) {
		const cta = parseCtaButton(raw.secondaryCta, `${path}.secondaryCta`, errors);
		if (cta) out.secondaryCta = cta;
	}
	return out;
}

export function parseFeatureGrid(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): FeatureGridSection | null {
	if (!isNonEmptyString(raw.heading)) {
		errors.push({ path: `${path}.heading`, message: "heading is required" });
		return null;
	}
	if (!Array.isArray(raw.items)) {
		errors.push({ path: `${path}.items`, message: "items must be an array" });
		return null;
	}
	const items: FeatureItem[] = [];
	raw.items.forEach((item, idx) => {
		if (!isObject(item)) {
			errors.push({ path: `${path}.items[${idx}]`, message: "must be object" });
			return;
		}
		if (!isNonEmptyString(item.title)) {
			errors.push({
				path: `${path}.items[${idx}].title`,
				message: "title required",
			});
			return;
		}
		if (!isNonEmptyString(item.body)) {
			errors.push({
				path: `${path}.items[${idx}].body`,
				message: "body required",
			});
			return;
		}
		const fi: FeatureItem = { title: item.title, body: item.body };
		if (typeof item.icon === "string" && item.icon.length > 0) fi.icon = item.icon;
		items.push(fi);
	});
	const out: FeatureGridSection = {
		id: String(raw.id),
		kind: "feature-grid",
		heading: raw.heading,
		columns: parseColumns(raw.columns),
		items,
	};
	if (typeof raw.intro === "string" && raw.intro.length > 0) out.intro = raw.intro;
	return out;
}

export function parseTestimonials(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): TestimonialsSection | null {
	const source = parseTestimonialSource(raw.source);
	const out: TestimonialsSection = {
		id: String(raw.id),
		kind: "testimonials",
		source,
		layout: parseTestimonialLayout(raw.layout),
	};
	if (typeof raw.heading === "string" && raw.heading.length > 0) {
		out.heading = raw.heading;
	}
	if (source === "ids") {
		if (!isStringArray(raw.ids) || raw.ids.length === 0) {
			errors.push({
				path: `${path}.ids`,
				message: "ids[] required when source=ids",
			});
			return null;
		}
		out.ids = raw.ids;
	}
	return out;
}

export function parseCtaBanner(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): CtaBannerSection | null {
	if (!isNonEmptyString(raw.headline)) {
		errors.push({ path: `${path}.headline`, message: "headline required" });
		return null;
	}
	const primary = parseCtaButton(raw.primaryCta, `${path}.primaryCta`, errors);
	if (!primary) return null;
	const out: CtaBannerSection = {
		id: String(raw.id),
		kind: "cta-banner",
		headline: raw.headline,
		primaryCta: primary,
		tone: parseTone(raw.tone),
	};
	if (typeof raw.body === "string" && raw.body.length > 0) out.body = raw.body;
	if (raw.secondaryCta !== undefined) {
		const sc = parseCtaButton(raw.secondaryCta, `${path}.secondaryCta`, errors);
		if (sc) out.secondaryCta = sc;
	}
	return out;
}

export function parseImageText(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): ImageTextSection | null {
	if (!isNonEmptyString(raw.heading)) {
		errors.push({ path: `${path}.heading`, message: "heading required" });
		return null;
	}
	if (!isNonEmptyString(raw.body)) {
		errors.push({ path: `${path}.body`, message: "body required" });
		return null;
	}
	if (typeof raw.mediaId !== "string") {
		errors.push({ path: `${path}.mediaId`, message: "mediaId must be string" });
		return null;
	}
	return {
		id: String(raw.id),
		kind: "image-text",
		heading: raw.heading,
		body: raw.body,
		mediaId: raw.mediaId,
		imageSide: parseImageSide(raw.imageSide),
	};
}

export function parseFaq(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): FaqSection | null {
	if (!Array.isArray(raw.items)) {
		errors.push({ path: `${path}.items`, message: "items must be an array" });
		return null;
	}
	const items: FaqItem[] = [];
	raw.items.forEach((item, idx) => {
		if (!isObject(item)) {
			errors.push({ path: `${path}.items[${idx}]`, message: "must be object" });
			return;
		}
		if (!isNonEmptyString(item.question)) {
			errors.push({
				path: `${path}.items[${idx}].question`,
				message: "question required",
			});
			return;
		}
		if (!isNonEmptyString(item.answer)) {
			errors.push({
				path: `${path}.items[${idx}].answer`,
				message: "answer required",
			});
			return;
		}
		items.push({ question: item.question, answer: item.answer });
	});
	const out: FaqSection = { id: String(raw.id), kind: "faq", items };
	if (typeof raw.heading === "string" && raw.heading.length > 0) {
		out.heading = raw.heading;
	}
	return out;
}

export function parseGallery(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): GallerySection | null {
	if (!isStringArray(raw.mediaIds)) {
		errors.push({
			path: `${path}.mediaIds`,
			message: "mediaIds must be string[]",
		});
		return null;
	}
	const out: GallerySection = {
		id: String(raw.id),
		kind: "gallery",
		mediaIds: raw.mediaIds,
		columns: parseColumns(raw.columns),
	};
	if (typeof raw.heading === "string" && raw.heading.length > 0) {
		out.heading = raw.heading;
	}
	return out;
}

export function parseRichText(
	// audit-boundary: opaque-passthrough -- parsed JSON section config; narrowed via field guards below
	raw: Record<string, unknown>,
	path: string,
	errors: SectionParseError[],
): RichTextSection | null {
	if (typeof raw.html !== "string") {
		errors.push({ path: `${path}.html`, message: "html must be a string" });
		return null;
	}
	return { id: String(raw.id), kind: "rich-text", html: raw.html };
}
