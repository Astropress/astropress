// Section schema types + scalar helpers. Extracted from schema.ts so
// schema-parsers.ts can import these without forming a cycle (schema.ts
// imports from schema-parsers.ts to wire its dispatcher).

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

export interface SectionParseError {
	path: string;
	message: string;
}

export interface SectionsParseSuccess {
	ok: true;
	sections: Section[];
}

export interface SectionsParseFailure {
	ok: false;
	errors: SectionParseError[];
}

export type SectionsParseResult = SectionsParseSuccess | SectionsParseFailure;

// audit-boundary: opaque-passthrough -- runtime type-guard for plain objects; values are user JSON
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

export function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function parseCtaButton(
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

export function parseAlignment(value: unknown): SectionAlignment {
	return value === "center" ? "center" : "start";
}

export function parseImageSide(value: unknown): ImageSide {
	return value === "end" ? "end" : "start";
}

export function parseTone(value: unknown): CtaTone {
	return value === "accent" ? "accent" : "neutral";
}

export function parseColumns(value: unknown): GridColumns {
	if (value === 2 || value === 3 || value === 4) return value;
	return 3;
}

export function parseTestimonialSource(value: unknown): TestimonialSource {
	if (value === "approved" || value === "ids") return value;
	return "featured";
}

export function parseTestimonialLayout(value: unknown): TestimonialLayout {
	return value === "carousel" ? "carousel" : "grid";
}

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
