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

import {
	type MediaRecord,
	getRuntimeMediaResolutionOptions,
	resolveMediaUrl,
} from "../media";
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
		switch (section.kind) {
			case "hero":
				if (section.mediaId) ids.add(section.mediaId);
				break;
			case "image-text":
				if (section.mediaId) ids.add(section.mediaId);
				break;
			case "gallery":
				for (const id of section.mediaIds) {
					if (id) ids.add(id);
				}
				break;
			default:
				break;
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

export function selectTestimonialsForSection(
	section: TestimonialsSection,
	all: TestimonialLike[],
): TestimonialLike[] {
	if (section.source === "ids" && section.ids) {
		const wanted = new Set(section.ids);
		return all.filter((t) => wanted.has(t.id));
	}
	if (section.source === "featured") {
		return all.filter(
			(t) => t.featured === true && (t.status ?? "approved") === "approved",
		);
	}
	return all.filter((t) => (t.status ?? "approved") === "approved");
}
