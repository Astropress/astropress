/**
 * Plain-string section renderer for the live editor preview.
 *
 * Mirrors the structure of the Astro components in components/sections/ but
 * outputs HTML strings — so the preview can run entirely client-side without
 * a server roundtrip per keystroke. Approximate (not pixel-perfect) but
 * close enough for editing.
 *
 * The full-fidelity renderer remains components/sections/Sections.astro;
 * this module exists only for the editor's live preview iframe.
 */

import type {
	CtaBannerSection,
	FaqSection,
	FeatureGridSection,
	GallerySection,
	HeroSection,
	ImageTextSection,
	RichTextSection,
	Section,
	TestimonialsSection,
} from "./schema";

export interface PreviewContext {
	mediaUrls: Record<string, string>;
	testimonials: Array<{
		id: string;
		name: string;
		role?: string | null;
		company?: string | null;
		quote: string;
		featured?: boolean;
		status?: string | null;
	}>;
	dir?: "ltr" | "rtl";
}

const escapeHtml = (v: string): string =>
	String(v)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

const escText = (v: string): string =>
	String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderHero(s: HeroSection, ctx: PreviewContext): string {
	const mediaUrl = s.mediaId ? ctx.mediaUrls[s.mediaId] : null;
	const align = s.alignment === "center" ? "center" : "start";
	return `
<section class="ap-section ap-hero" data-align="${escapeHtml(align)}">
  ${mediaUrl ? `<div class="ap-hero__media" aria-hidden="true"><img src="${escapeHtml(mediaUrl)}" alt="" /></div>` : ""}
  <div class="ap-hero__inner">
    <h1 class="ap-hero__headline">${escText(s.headline)}</h1>
    ${s.subhead ? `<p class="ap-hero__subhead">${escText(s.subhead)}</p>` : ""}
    ${
			s.primaryCta || s.secondaryCta
				? `<div class="ap-hero__cta">
      ${s.primaryCta ? `<a class="ap-btn ap-btn--primary" href="${escapeHtml(s.primaryCta.href)}">${escText(s.primaryCta.label)}</a>` : ""}
      ${s.secondaryCta ? `<a class="ap-btn ap-btn--secondary" href="${escapeHtml(s.secondaryCta.href)}">${escText(s.secondaryCta.label)}</a>` : ""}
    </div>`
				: ""
		}
  </div>
</section>`;
}

function renderFeatureGrid(s: FeatureGridSection): string {
	return `
<section class="ap-section ap-feature-grid" data-columns="${s.columns}">
  <div class="ap-feature-grid__head">
    <h2 class="ap-feature-grid__heading">${escText(s.heading)}</h2>
    ${s.intro ? `<p class="ap-feature-grid__intro">${escText(s.intro)}</p>` : ""}
  </div>
  <ul class="ap-feature-grid__items" role="list">
    ${s.items
			.map(
				(item) => `
    <li class="ap-feature-grid__item">
      ${item.icon ? `<span class="ap-feature-grid__icon" aria-hidden="true">${escText(item.icon)}</span>` : ""}
      <h3 class="ap-feature-grid__title">${escText(item.title)}</h3>
      <p class="ap-feature-grid__body">${escText(item.body)}</p>
    </li>`,
			)
			.join("")}
  </ul>
</section>`;
}

function renderTestimonials(
	s: TestimonialsSection,
	ctx: PreviewContext,
): string {
	const all = ctx.testimonials;
	const isApproved = (t: PreviewContext["testimonials"][number]) =>
		(t.status ?? "approved") === "approved";
	let picked: PreviewContext["testimonials"];
	if (s.source === "ids" && s.ids) {
		const wanted = new Set(s.ids);
		picked = all.filter((t) => wanted.has(t.id));
	} else if (s.source === "featured") {
		picked = all.filter((t) => t.featured === true && isApproved(t));
	} else {
		picked = all.filter(isApproved);
	}
	const layout = s.layout === "carousel" ? "carousel" : "grid";
	return `
<section class="ap-section ap-testimonials" data-layout="${escapeHtml(layout)}">
  ${s.heading ? `<h2 class="ap-testimonials__heading">${escText(s.heading)}</h2>` : ""}
  ${
		picked.length === 0
			? `<p class="ap-testimonials__empty">No testimonials yet.</p>`
			: `<ul class="ap-testimonials__list" role="list">
    ${picked
			.map(
				(t) => `
    <li class="ap-testimonials__item">
      <blockquote class="ap-testimonials__quote">${escText(t.quote)}</blockquote>
      <footer class="ap-testimonials__cite">
        <span class="ap-testimonials__name">${escText(t.name)}</span>
        ${
					t.role || t.company
						? `<span class="ap-testimonials__meta">${escText(
								[t.role, t.company].filter(Boolean).join(" — "),
							)}</span>`
						: ""
				}
      </footer>
    </li>`,
			)
			.join("")}
  </ul>`
	}
</section>`;
}

function renderCtaBanner(s: CtaBannerSection): string {
	return `
<section class="ap-section ap-cta" data-tone="${escapeHtml(s.tone)}">
  <div class="ap-cta__inner">
    <h2 class="ap-cta__headline">${escText(s.headline)}</h2>
    ${s.body ? `<p class="ap-cta__body">${escText(s.body)}</p>` : ""}
    <div class="ap-cta__actions">
      <a class="ap-btn ap-btn--primary" href="${escapeHtml(s.primaryCta.href)}">${escText(s.primaryCta.label)}</a>
      ${s.secondaryCta ? `<a class="ap-btn ap-btn--secondary" href="${escapeHtml(s.secondaryCta.href)}">${escText(s.secondaryCta.label)}</a>` : ""}
    </div>
  </div>
</section>`;
}

function renderImageText(s: ImageTextSection, ctx: PreviewContext): string {
	const mediaUrl = ctx.mediaUrls[s.mediaId] ?? null;
	const side = s.imageSide === "end" ? "end" : "start";
	return `
<section class="ap-section ap-image-text" data-image-side="${escapeHtml(side)}">
  <div class="ap-image-text__media">
    ${
			mediaUrl
				? `<img src="${escapeHtml(mediaUrl)}" alt="" />`
				: `<div class="ap-image-text__placeholder" aria-hidden="true"></div>`
		}
  </div>
  <div class="ap-image-text__copy">
    <h2 class="ap-image-text__heading">${escText(s.heading)}</h2>
    <div class="ap-image-text__body">${s.body}</div>
  </div>
</section>`;
}

function renderFaq(s: FaqSection): string {
	return `
<section class="ap-section ap-faq">
  ${s.heading ? `<h2 class="ap-faq__heading">${escText(s.heading)}</h2>` : ""}
  <ul class="ap-faq__list" role="list">
    ${s.items
			.map(
				(item) => `
    <li class="ap-faq__item">
      <details class="ap-faq__details">
        <summary class="ap-faq__question">${escText(item.question)}</summary>
        <div class="ap-faq__answer">${escText(item.answer)}</div>
      </details>
    </li>`,
			)
			.join("")}
  </ul>
</section>`;
}

function renderGallery(s: GallerySection, ctx: PreviewContext): string {
	const items = s.mediaIds
		.map((id) => ({ id, url: ctx.mediaUrls[id] }))
		.filter((entry) => Boolean(entry.url));
	return `
<section class="ap-section ap-gallery" data-columns="${s.columns}">
  ${s.heading ? `<h2 class="ap-gallery__heading">${escText(s.heading)}</h2>` : ""}
  ${
		items.length === 0
			? `<p class="ap-gallery__empty">No images yet.</p>`
			: `<ul class="ap-gallery__items" role="list">${items
					.map(
						(it) =>
							`<li class="ap-gallery__item"><img src="${escapeHtml(it.url ?? "")}" alt="" /></li>`,
					)
					.join("")}</ul>`
	}
</section>`;
}

function renderRichText(s: RichTextSection): string {
	return `<section class="ap-section ap-rich-text"><div class="ap-rich-text__inner">${s.html}</div></section>`;
}

function renderSection(section: Section, ctx: PreviewContext): string {
	switch (section.kind) {
		case "hero":
			return renderHero(section, ctx);
		case "feature-grid":
			return renderFeatureGrid(section);
		case "testimonials":
			return renderTestimonials(section, ctx);
		case "cta-banner":
			return renderCtaBanner(section);
		case "image-text":
			return renderImageText(section, ctx);
		case "faq":
			return renderFaq(section);
		case "gallery":
			return renderGallery(section, ctx);
		case "rich-text":
			return renderRichText(section);
	}
}

/**
 * Build a complete <iframe>-ready document containing the rendered sections
 * and the public sections.css. Used as iframe srcdoc.
 */
export function renderSectionsDocument(
	sections: Section[],
	ctx: PreviewContext,
	options: { stylesheetUrl?: string } = {},
): string {
	const dir = ctx.dir === "rtl" ? "rtl" : "ltr";
	const stylesheet = options.stylesheetUrl
		? `<link rel="stylesheet" href="${escapeHtml(options.stylesheetUrl)}" />`
		: "";
	return `<!doctype html>
<html lang="en" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
${stylesheet}
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#fff}</style>
</head>
<body>
<div class="ap-sections">${sections.map((s) => renderSection(s, ctx)).join("")}</div>
</body>
</html>`;
}
