/**
 * Pre-render helpers for the section dispatcher.
 *
 * The dispatcher needs:
 *   - a Map<mediaId, publicUrl> for sections that reference media
 *   - a list of testimonial records for testimonials sections
 *
 * Both are gathered server-side so the components themselves stay
 * pure (props-in, HTML-out) and the public route only does one set
 * of DB lookups instead of N per-section ones.
 */

import { getRuntimeMediaResolutionOptions, type MediaRecord, resolveMediaUrl } from "../media";
import type { Section, TestimonialsSection } from "./schema";

export interface MediaLike extends MediaRecord {
	id: string;
}

export interface TestimonialLike {
	id: string;
	name: string;
	role?: string | null;
	company?: string | null;
	quote: string;
	status?: string | null;
	featured?: boolean;
}

export interface SectionRenderContext {
	mediaUrls: Record<string, string>;
	testimonials: TestimonialLike[];
}

export function collectMediaIds(sections: Section[]): string[] {
	const ids = new Set<string>();
	for (const section of sections) {
		if (section.kind === "hero" || section.kind === "image-text") {
			if (section.mediaId) ids.add(section.mediaId);
		} else if (section.kind === "gallery") {
			for (const id of section.mediaIds) {
				if (id) ids.add(id);
			}
		}
	}
	return [...ids];
}

export function buildMediaUrlMap(
	records: MediaLike[],
	locals?: App.Locals | null,
): Record<string, string> {
	const opts = getRuntimeMediaResolutionOptions(locals);
	const out: Record<string, string> = {};
	for (const record of records) {
		const url = resolveMediaUrl(record, opts);
		if (url) out[record.id] = url;
	}
	return out;
}

/**
 * Store-level testimonial submission, as returned by getRuntimeTestimonials.
 * Structural (not the persistence type) so hosts with custom runtimes can
 * feed their own records through the same public mapping.
 */
export interface TestimonialSubmissionLike {
	id: string;
	name: string;
	role?: string;
	company?: string;
	beforeState?: string;
	transformation?: string;
	specificResult?: string;
	consentToPublish: boolean;
	status?: string | null;
}

/**
 * Map a store submission to the shape the section renderers consume, or null
 * when it must not appear publicly. This is the single choke point for the
 * two public-display gates: consentToPublish, and having any quotable text
 * (specificResult, falling back to transformation). The store's "featured"
 * status becomes the renderer's featured flag; featured implies approved.
 */
export function toPublicTestimonial(s: TestimonialSubmissionLike): TestimonialLike | null {
	if (!s.consentToPublish) return null;
	const quote = s.specificResult || s.transformation || "";
	if (!quote) return null;
	const featured = s.status === "featured";
	return {
		id: s.id,
		name: s.name,
		role: s.role ?? null,
		company: s.company ?? null,
		quote,
		featured,
		status: featured ? "approved" : (s.status ?? "approved"),
	};
}

export interface SectionContentReaders {
	listMediaAssets(): Promise<MediaLike[]>;
	listPublicTestimonials(): Promise<TestimonialSubmissionLike[]>;
}

/**
 * Build the render context for a parsed sections array. Only touches the
 * store for what the sections actually reference: media lookups are skipped
 * when no section carries a mediaId, testimonial lookups when no
 * testimonials section exists — so prerendering a plain text page costs no
 * extra reads.
 */
export async function buildSectionRenderContext(
	sections: Section[],
	readers: SectionContentReaders,
	locals?: App.Locals | null,
): Promise<SectionRenderContext> {
	const mediaIds = new Set(collectMediaIds(sections));
	const mediaUrls = mediaIds.size
		? buildMediaUrlMap(
				(await readers.listMediaAssets()).filter((record) => mediaIds.has(record.id)),
				locals,
			)
		: {};
	const testimonials = sections.some((section) => section.kind === "testimonials")
		? (await readers.listPublicTestimonials())
				.map(toPublicTestimonial)
				.filter((t): t is TestimonialLike => t !== null)
		: [];
	return { mediaUrls, testimonials };
}

function isApproved(t: TestimonialLike): boolean {
	return (t.status ?? "approved") === "approved";
}

export function selectTestimonialsForSection(
	section: TestimonialsSection,
	all: TestimonialLike[],
): TestimonialLike[] {
	if (section.source === "ids" && section.ids) {
		const wanted = new Set(section.ids);
		return all.filter((t) => wanted.has(t.id));
	}
	if (section.source === "featured") {
		return all.filter((t) => t.featured === true && isApproved(t));
	}
	return all.filter(isApproved);
}
