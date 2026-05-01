/**
 * Page templates — pre-baked starting section lists for common page types.
 * Operators pick a template at "Add section" time on a blank page; the
 * template's sections are cloned with fresh IDs and placed in the editor.
 */

import type { Section, SectionKind } from "./schema";

export type TemplateKey = "blank" | "landing" | "about" | "contact";

export const TEMPLATE_KEYS: readonly TemplateKey[] = [
	"blank",
	"landing",
	"about",
	"contact",
] as const;

interface TemplateSpec {
	key: TemplateKey;
	build: (idGen: () => string) => Section[];
}

const SAMPLE_HEADLINE = "Tell your story";
const SAMPLE_SUBHEAD =
	"Replace this copy with the message that matters most to your visitors.";

const templates: Record<TemplateKey, TemplateSpec> = {
	blank: {
		key: "blank",
		build: () => [],
	},
	landing: {
		key: "landing",
		build: (id) => [
			{
				id: id(),
				kind: "hero",
				headline: SAMPLE_HEADLINE,
				subhead: SAMPLE_SUBHEAD,
				alignment: "center",
				primaryCta: { label: "Get started", href: "#" },
			},
			{
				id: id(),
				kind: "feature-grid",
				heading: "What you get",
				columns: 3,
				items: [
					{ title: "Fast", body: "Optimised for speed on every device." },
					{
						title: "Open",
						body: "No vendor lock-in. Your content, your rules.",
					},
					{
						title: "Yours",
						body: "Customise everything — or just ship the defaults.",
					},
				],
			},
			{
				id: id(),
				kind: "testimonials",
				heading: "Trusted by people like you",
				source: "featured",
				layout: "grid",
			},
			{
				id: id(),
				kind: "cta-banner",
				headline: "Ready to start?",
				body: "Take the next step.",
				primaryCta: { label: "Sign up", href: "#" },
				tone: "accent",
			},
		],
	},
	about: {
		key: "about",
		build: (id) => [
			{
				id: id(),
				kind: "hero",
				headline: "About us",
				subhead: "A short, honest description of who we are.",
				alignment: "start",
			},
			{
				id: id(),
				kind: "image-text",
				heading: "Our story",
				body: "Replace this with the story that brought you here.",
				mediaId: "",
				imageSide: "start",
			},
			{
				id: id(),
				kind: "feature-grid",
				heading: "What drives us",
				columns: 2,
				items: [
					{ title: "Our values", body: "What we believe and why." },
					{ title: "Our approach", body: "How we work — in plain language." },
				],
			},
			{
				id: id(),
				kind: "cta-banner",
				headline: "Get in touch",
				primaryCta: { label: "Contact us", href: "#" },
				tone: "neutral",
			},
		],
	},
	contact: {
		key: "contact",
		build: (id) => [
			{
				id: id(),
				kind: "hero",
				headline: "Contact",
				subhead: "Reach us through any of these channels.",
				alignment: "start",
			},
			{
				id: id(),
				kind: "image-text",
				heading: "Where to find us",
				body: "Replace this with your contact details.",
				mediaId: "",
				imageSide: "end",
			},
			{
				id: id(),
				kind: "faq",
				heading: "Frequently asked",
				items: [
					{
						question: "How quickly do you reply?",
						answer: "Usually within a business day.",
					},
					{
						question: "Do you offer support?",
						answer: "Yes — see the link in the footer.",
					},
				],
			},
			{
				id: id(),
				kind: "cta-banner",
				headline: "Prefer email?",
				primaryCta: {
					label: "Send a message",
					href: "mailto:hello@example.com",
				},
				tone: "neutral",
			},
		],
	},
};

function defaultIdGen(): () => string {
	let n = 0;
	return () => {
		n += 1;
		return `tmpl-${Date.now().toString(36)}-${n}`;
	};
}

export function buildTemplate(
	key: TemplateKey,
	idGen: () => string = defaultIdGen(),
): Section[] {
	const spec = templates[key];
	if (!spec) return [];
	return spec.build(idGen);
}

export function isTemplateKey(value: string): value is TemplateKey {
	return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

/**
 * Catalog entry for the picker UI — kind name + description in EN
 * (translated label keys live in admin-page-labels.ts under
 * `pageTemplates.<key>.title|description`).
 */
export interface TemplateCatalogEntry {
	key: TemplateKey;
	defaultTitle: string;
	defaultDescription: string;
	sectionKinds: SectionKind[];
}

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
	{
		key: "blank",
		defaultTitle: "Blank",
		defaultDescription: "Start from scratch.",
		sectionKinds: [],
	},
	{
		key: "landing",
		defaultTitle: "Landing page",
		defaultDescription: "Hero, features, testimonials, and a call-to-action.",
		sectionKinds: ["hero", "feature-grid", "testimonials", "cta-banner"],
	},
	{
		key: "about",
		defaultTitle: "About page",
		defaultDescription: "Hero, story, values, and a call-to-action.",
		sectionKinds: ["hero", "image-text", "feature-grid", "cta-banner"],
	},
	{
		key: "contact",
		defaultTitle: "Contact page",
		defaultDescription: "Hero, contact details, FAQ, and a call-to-action.",
		sectionKinds: ["hero", "image-text", "faq", "cta-banner"],
	},
] as const;
