/**
 * Section schema for the structured page editor.
 *
 * Sections are the unit of content for marketing / landing-style pages.
 * Each section has a kind discriminator and a per-kind shape. Sections
 * are persisted as JSON in cms_route_variants.sections_json and rendered
 * by per-kind Astro components on the public site.
 */

export type SectionAlignment = "start" | "center";
export type ImageSide = "start" | "end";
export type CtaTone = "neutral" | "accent";
export type TestimonialSource = "featured" | "approved" | "ids";
export type GridColumns = 2 | 3 | 4;
export type TestimonialLayout = "grid" | "carousel";

export interface CtaButton {
	label: string;
	href: string;
}

export interface FeatureItem {
	icon?: string;
	title: string;
	body: string;
}

export interface FaqItem {
	question: string;
	answer: string;
}

export interface SectionBase {
	id: string;
	kind: string;
}

export interface HeroSection extends SectionBase {
	kind: "hero";
	headline: string;
	subhead?: string;
	primaryCta?: CtaButton;
	secondaryCta?: CtaButton;
	mediaId?: string;
	alignment: SectionAlignment;
}

export interface FeatureGridSection extends SectionBase {
	kind: "feature-grid";
	heading: string;
	intro?: string;
	columns: GridColumns;
	items: FeatureItem[];
}

export interface TestimonialsSection extends SectionBase {
	kind: "testimonials";
	heading?: string;
	source: TestimonialSource;
	ids?: string[];
	layout: TestimonialLayout;
}

export interface CtaBannerSection extends SectionBase {
	kind: "cta-banner";
	headline: string;
	body?: string;
	primaryCta: CtaButton;
	secondaryCta?: CtaButton;
	tone: CtaTone;
}

export interface ImageTextSection extends SectionBase {
	kind: "image-text";
	heading: string;
	body: string;
	mediaId: string;
	imageSide: ImageSide;
}

export interface FaqSection extends SectionBase {
	kind: "faq";
	heading?: string;
	items: FaqItem[];
}

export interface GallerySection extends SectionBase {
	kind: "gallery";
	heading?: string;
	mediaIds: string[];
	columns: GridColumns;
}

export interface RichTextSection extends SectionBase {
	kind: "rich-text";
	html: string;
}

export type Section =
	| HeroSection
	| FeatureGridSection
	| TestimonialsSection
	| CtaBannerSection
	| ImageTextSection
	| FaqSection
	| GallerySection
	| RichTextSection;

export type SectionKind = Section["kind"];

export const SECTION_KINDS: readonly SectionKind[] = [
	"hero",
	"feature-grid",
	"testimonials",
	"cta-banner",
	"image-text",
	"faq",
	"gallery",
	"rich-text",
] as const;

export interface SectionsParseSuccess {
	ok: true;
	sections: Section[];
}

export interface SectionsParseFailure {
	ok: false;
	errors: SectionParseError[];
}

export interface SectionParseError {
	path: string;
	message: string;
}

export type SectionsParseResult = SectionsParseSuccess | SectionsParseFailure;

// audit-boundary: opaque-passthrough -- runtime type-guard for plain objects; values are user JSON
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseCtaButton(
	value: unknown,
	path: string,
	errors: SectionParseError[],
): CtaButton | undefined {
	if (!isObject(value)) {
		errors.push({ path, message: "must be an object with label + href" });
		return undefined;
	}
	if (!isNonEmptyString(value.label)) {
		errors.push({ path: `${path}.label`, message: "label is required" });
		return undefined;
	}
	if (!isNonEmptyString(value.href)) {
		errors.push({ path: `${path}.href`, message: "href is required" });
		return undefined;
	}
	return { label: value.label, href: value.href };
}

function parseAlignment(value: unknown): SectionAlignment {
	return value === "center" ? "center" : "start";
}

function parseImageSide(value: unknown): ImageSide {
	return value === "end" ? "end" : "start";
}

function parseTone(value: unknown): CtaTone {
	return value === "accent" ? "accent" : "neutral";
}

function parseColumns(value: unknown): GridColumns {
	if (value === 2 || value === 3 || value === 4) return value;
	return 3;
}

function parseTestimonialSource(value: unknown): TestimonialSource {
	if (value === "approved" || value === "ids") return value;
	return "featured";
}

function parseTestimonialLayout(value: unknown): TestimonialLayout {
	return value === "carousel" ? "carousel" : "grid";
}

function parseHero(
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
		const cta = parseCtaButton(
			raw.secondaryCta,
			`${path}.secondaryCta`,
			errors,
		);
		if (cta) out.secondaryCta = cta;
	}
	return out;
}

function parseFeatureGrid(
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
		if (typeof item.icon === "string" && item.icon.length > 0)
			fi.icon = item.icon;
		items.push(fi);
	});
	const out: FeatureGridSection = {
		id: String(raw.id),
		kind: "feature-grid",
		heading: raw.heading,
		columns: parseColumns(raw.columns),
		items,
	};
	if (typeof raw.intro === "string" && raw.intro.length > 0)
		out.intro = raw.intro;
	return out;
}

function parseTestimonials(
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

function parseCtaBanner(
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

function parseImageText(
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

function parseFaq(
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

function parseGallery(
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

function parseRichText(
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

function parseSection(
	raw: unknown,
	path: string,
	errors: SectionParseError[],
): Section | null {
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
					message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
				},
			],
		};
	}
	return parseSections(parsed);
}
