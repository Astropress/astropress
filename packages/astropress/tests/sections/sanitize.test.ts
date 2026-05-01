import { describe, expect, it } from "vitest";
import { sanitizeSections } from "../../src/sections/sanitize";
import type { Section } from "../../src/sections/schema";

describe("sanitizeSections", () => {
	it("strips <script> from rich-text html", async () => {
		const input: Section[] = [
			{
				id: "r",
				kind: "rich-text",
				html: "<p>ok</p><script>alert(1)</script>",
			},
		];
		const out = await sanitizeSections(input);
		expect(out[0].kind).toBe("rich-text");
		if (out[0].kind === "rich-text") {
			expect(out[0].html).not.toContain("<script");
			expect(out[0].html).toContain("<p>");
		}
	});

	it("strips <script> from image-text body", async () => {
		const input: Section[] = [
			{
				id: "it",
				kind: "image-text",
				heading: "H",
				body: "<p>ok</p><script>x</script>",
				mediaId: "m1",
				imageSide: "start",
			},
		];
		const out = await sanitizeSections(input);
		if (out[0].kind === "image-text") {
			expect(out[0].body).not.toContain("<script");
		}
	});

	it("preserves non-html sections unchanged", async () => {
		const input: Section[] = [
			{
				id: "h",
				kind: "hero",
				headline: "<b>raw</b> headline",
				alignment: "start",
			},
		];
		const out = await sanitizeSections(input);
		// headline is plain text rendered via {expression}, not html, so stays raw.
		if (out[0].kind === "hero") {
			expect(out[0].headline).toBe("<b>raw</b> headline");
		}
	});

	it("returns the same length as input", async () => {
		const input: Section[] = [
			{ id: "a", kind: "rich-text", html: "<p>1</p>" },
			{ id: "b", kind: "faq", items: [] },
		];
		const out = await sanitizeSections(input);
		expect(out).toHaveLength(2);
	});
});
