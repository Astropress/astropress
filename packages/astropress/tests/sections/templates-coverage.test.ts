/**
 * Branch / literal coverage for sections/templates.ts.
 */
import { describe, expect, it } from "vitest";
import {
	buildTemplate,
	isTemplateKey,
	TEMPLATE_CATALOG,
	TEMPLATE_KEYS,
} from "../../src/sections/templates";

describe("templates content", () => {
	it("landing[0] hero alignment is 'center' with headline + subhead + primaryCta", () => {
		const sections = buildTemplate("landing");
		const hero = sections[0];
		if (hero.kind !== "hero") throw new Error();
		expect(hero.alignment).toBe("center");
		expect(hero.headline).toBe("Tell your story");
		expect(hero.subhead).toContain("Replace this copy");
		expect(hero.primaryCta).toEqual({ label: "Get started", href: "#" });
	});

	it("landing feature-grid has 3 columns and 3 items", () => {
		const sections = buildTemplate("landing");
		const fg = sections[1];
		if (fg.kind !== "feature-grid") throw new Error();
		expect(fg.columns).toBe(3);
		expect(fg.items).toHaveLength(3);
		expect(fg.heading).toBe("What you get");
	});

	it("landing testimonials section is featured + grid", () => {
		const sections = buildTemplate("landing");
		const t = sections[2];
		if (t.kind !== "testimonials") throw new Error();
		expect(t.source).toBe("featured");
		expect(t.layout).toBe("grid");
		expect(t.heading).toBe("Trusted by people like you");
	});

	it("landing cta-banner uses 'accent' tone", () => {
		const sections = buildTemplate("landing");
		const c = sections[3];
		if (c.kind !== "cta-banner") throw new Error();
		expect(c.tone).toBe("accent");
		expect(c.headline).toBe("Ready to start?");
		expect(c.body).toBe("Take the next step.");
		expect(c.primaryCta).toEqual({ label: "Sign up", href: "#" });
	});

	it("about hero alignment is 'start'", () => {
		const sections = buildTemplate("about");
		const hero = sections[0];
		if (hero.kind !== "hero") throw new Error();
		expect(hero.alignment).toBe("start");
		expect(hero.headline).toBe("About us");
	});

	it("about image-text imageSide is 'start' with empty mediaId", () => {
		const sections = buildTemplate("about");
		const img = sections[1];
		if (img.kind !== "image-text") throw new Error();
		expect(img.imageSide).toBe("start");
		expect(img.mediaId).toBe("");
		expect(img.heading).toBe("Our story");
	});

	it("about feature-grid uses 2 columns and 2 items", () => {
		const sections = buildTemplate("about");
		const fg = sections[2];
		if (fg.kind !== "feature-grid") throw new Error();
		expect(fg.columns).toBe(2);
		expect(fg.items).toHaveLength(2);
	});

	it("about cta-banner uses 'neutral' tone", () => {
		const sections = buildTemplate("about");
		const c = sections[3];
		if (c.kind !== "cta-banner") throw new Error();
		expect(c.tone).toBe("neutral");
		expect(c.primaryCta.label).toBe("Contact us");
	});

	it("contact image-text imageSide is 'end'", () => {
		const sections = buildTemplate("contact");
		const img = sections[1];
		if (img.kind !== "image-text") throw new Error();
		expect(img.imageSide).toBe("end");
	});

	it("contact faq has 2 items", () => {
		const sections = buildTemplate("contact");
		const faq = sections[2];
		if (faq.kind !== "faq") throw new Error();
		expect(faq.items).toHaveLength(2);
		expect(faq.heading).toBe("Frequently asked");
	});

	it("contact cta-banner href is mailto:", () => {
		const sections = buildTemplate("contact");
		const c = sections[3];
		if (c.kind !== "cta-banner") throw new Error();
		expect(c.primaryCta.href).toBe("mailto:hello@example.com");
		expect(c.primaryCta.label).toBe("Send a message");
	});
});

describe("templates id generation", () => {
	it("default id generator yields unique ids within a single template", () => {
		const sections = buildTemplate("landing");
		const ids = sections.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toMatch(/^tmpl-/);
	});

	it("custom idGen receives sequential calls", () => {
		const ids: string[] = [];
		let n = 0;
		const sections = buildTemplate("landing", () => {
			n += 1;
			const id = `id-${n}`;
			ids.push(id);
			return id;
		});
		expect(sections.map((s) => s.id)).toEqual(ids);
		expect(ids).toEqual(["id-1", "id-2", "id-3", "id-4"]);
	});

	it("blank template doesn't invoke idGen", () => {
		let calls = 0;
		buildTemplate("blank", () => {
			calls += 1;
			return `x-${calls}`;
		});
		expect(calls).toBe(0);
	});
});

describe("templates safety", () => {
	it("buildTemplate with unknown key returns empty array", () => {
		// Cast — the function signature requires TemplateKey but the runtime
		// guard handles unknown keys defensively.
		const sections = buildTemplate("nope" as never);
		expect(sections).toEqual([]);
	});

	it("isTemplateKey returns true for every TEMPLATE_KEYS entry", () => {
		for (const key of TEMPLATE_KEYS) expect(isTemplateKey(key)).toBe(true);
	});

	it("isTemplateKey rejects empty string", () => {
		expect(isTemplateKey("")).toBe(false);
	});
});

describe("templates catalog", () => {
	it("blank entry has empty section list and 'Blank' title", () => {
		const blank = TEMPLATE_CATALOG.find((e) => e.key === "blank");
		expect(blank?.defaultTitle).toBe("Blank");
		expect(blank?.sectionKinds).toEqual([]);
		expect(blank?.defaultDescription).toBe("Start from scratch.");
	});

	it("landing entry has 4 section kinds in order", () => {
		const e = TEMPLATE_CATALOG.find((c) => c.key === "landing");
		expect(e?.sectionKinds).toEqual(["hero", "feature-grid", "testimonials", "cta-banner"]);
		expect(e?.defaultTitle).toBe("Landing page");
	});

	it("about entry catalog details", () => {
		const e = TEMPLATE_CATALOG.find((c) => c.key === "about");
		expect(e?.defaultTitle).toBe("About page");
		expect(e?.sectionKinds).toEqual(["hero", "image-text", "feature-grid", "cta-banner"]);
	});

	it("contact entry catalog details", () => {
		const e = TEMPLATE_CATALOG.find((c) => c.key === "contact");
		expect(e?.defaultTitle).toBe("Contact page");
		expect(e?.sectionKinds).toEqual(["hero", "image-text", "faq", "cta-banner"]);
	});

	it("TEMPLATE_KEYS is in canonical order", () => {
		expect(TEMPLATE_KEYS).toEqual(["blank", "landing", "about", "contact"]);
	});
});
