/**
 * HTML sanitization for sections that accept rich content.
 *
 * Runs at SAVE time (not render time) so the persisted payload is
 * already safe — the renderer can output the stored html with set:html
 * without re-sanitizing on every request.
 *
 * Currently: ImageText.body and RichText.html are HTML-bearing fields.
 * Other sections store plain strings only.
 */

import { sanitizeHtml } from "../html-sanitization";
import type { Section } from "./schema";

export async function sanitizeSections(sections: Section[]): Promise<Section[]> {
	const out: Section[] = [];
	for (const section of sections) {
		if (section.kind === "rich-text") {
			out.push({ ...section, html: await sanitizeHtml(section.html) });
		} else if (section.kind === "image-text") {
			out.push({ ...section, body: await sanitizeHtml(section.body) });
		} else {
			out.push(section);
		}
	}
	return out;
}
