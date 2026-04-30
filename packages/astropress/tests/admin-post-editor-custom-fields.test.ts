import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level invariants for the post-editor's custom-field auto-generation.
// Single-target test: only reads pages/ap-admin/posts/[slug].astro. Mutations
// to other files do not invalidate this suite's stryker cache.

const editorPath = path.resolve(
	import.meta.dirname,
	"../pages/ap-admin/posts/[slug].astro",
);

describe("post editor custom field auto-generation", () => {
	it("post editor uses peekCmsConfig to find registered content types", () => {
		const source = readFileSync(editorPath, "utf8");
		expect(source).toContain("peekCmsConfig");
		expect(source).toContain("contentTypes");
		expect(source).toContain("data-ap-custom-fields");
	});

	it("post editor generates text input with metadata. prefix for text fields", () => {
		const source = readFileSync(editorPath, "utf8");
		// Input name pattern must be metadata.{field.name}
		expect(source).toContain("`metadata.${field.name}`");
		expect(source).toContain('type="text"');
		expect(source).toContain('type="checkbox"');
	});

	it("post editor generates select inputs for select-type fields", () => {
		const source = readFileSync(editorPath, "utf8");
		expect(source).toContain('field.type === "select"');
		expect(source).toContain("<select");
	});

	it("post editor marks required fields with asterisk in label", () => {
		const source = readFileSync(editorPath, "utf8");
		expect(source).toContain("field.required");
		// Required fields get an asterisk in the label
		expect(source).toContain('" *"');
	});
});
