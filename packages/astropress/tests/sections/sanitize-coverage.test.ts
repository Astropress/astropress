import { describe, expect, it } from "vitest";
import { sanitizeSections } from "../../src/sections/sanitize";
import type { Section } from "../../src/sections/schema";

describe("sanitizeSections — coverage", () => {
	it("returns an empty array when input is empty", async () => {
		const out = await sanitizeSections([]);
		expect(out).toEqual([]);
	});

	it("preserves section order", async () => {
		const input: Section[] = [
			{ id: "h", kind: "hero", headline: "h", alignment: "start" },
			{ id: "r", kind: "rich-text", html: "<p>a</p>" },
			{ id: "f", kind: "faq", items: [] },
			{
				id: "i",
				kind: "image-text",
				heading: "H",
				body: "<p>b</p>",
				mediaId: "",
				imageSide: "start",
			},
		];
		const out = await sanitizeSections(input);
		expect(out.map((s) => s.id)).toEqual(["h", "r", "f", "i"]);
	});

	it("keeps non-html-bearing kinds object-equal in shape", async () => {
		const input: Section[] = [
			{ id: "g", kind: "gallery", mediaIds: ["a"], columns: 3 },
		];
		const out = await sanitizeSections(input);
		expect(out[0]).toEqual(input[0]);
	});

	it("rich-text retains kind discriminator after sanitization", async () => {
		const out = await sanitizeSections([
			{ id: "r", kind: "rich-text", html: "<p>x</p>" },
		]);
		expect(out[0].kind).toBe("rich-text");
	});

	it("image-text retains heading + mediaId + imageSide unchanged", async () => {
		const out = await sanitizeSections([
			{
				id: "i",
				kind: "image-text",
				heading: "H",
				body: "<p>x</p><script>q()</script>",
				mediaId: "m",
				imageSide: "end",
			},
		]);
		const it0 = out[0];
		if (it0.kind !== "image-text") throw new Error();
		expect(it0.heading).toBe("H");
		expect(it0.mediaId).toBe("m");
		expect(it0.imageSide).toBe("end");
		expect(it0.body).not.toContain("<script");
	});

	it("strips dangerous attributes from rich-text", async () => {
		const out = await sanitizeSections([
			{
				id: "r",
				kind: "rich-text",
				html: '<a href="javascript:alert(1)">x</a>',
			},
		]);
		if (out[0].kind === "rich-text") {
			expect(out[0].html).not.toContain("javascript:");
		}
	});
});
