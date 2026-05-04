import { describe, expect, it } from "vitest";

import { normalizeRoutePath, stripTrailingSlashes } from "../src/path-helpers";

describe("stripTrailingSlashes", () => {
	it("returns the input unchanged when there are no trailing slashes", () => {
		expect(stripTrailingSlashes("https://example.com")).toBe(
			"https://example.com",
		);
		expect(stripTrailingSlashes("/about")).toBe("/about");
		expect(stripTrailingSlashes("")).toBe("");
	});

	it("strips a single trailing slash", () => {
		expect(stripTrailingSlashes("https://example.com/")).toBe(
			"https://example.com",
		);
		expect(stripTrailingSlashes("/about/")).toBe("/about");
	});

	it("strips multiple trailing slashes", () => {
		expect(stripTrailingSlashes("/about///")).toBe("/about");
		expect(stripTrailingSlashes("https://example.com////")).toBe(
			"https://example.com",
		);
	});

	it("collapses an all-slash string to empty", () => {
		expect(stripTrailingSlashes("/")).toBe("");
		expect(stripTrailingSlashes("////")).toBe("");
	});

	it("does not touch slashes that are not at the end", () => {
		expect(stripTrailingSlashes("/a/b/c")).toBe("/a/b/c");
		expect(stripTrailingSlashes("/a//b")).toBe("/a//b");
	});

	it("does not strip a leading slash", () => {
		expect(stripTrailingSlashes("/")).toBe("");
		expect(stripTrailingSlashes("/leading")).toBe("/leading");
	});

	it("handles a single character input", () => {
		expect(stripTrailingSlashes("a")).toBe("a");
		expect(stripTrailingSlashes("/")).toBe("");
	});
});

describe("normalizeRoutePath", () => {
	it("returns '/' for empty input", () => {
		expect(normalizeRoutePath("")).toBe("/");
	});

	it("returns '/' for an all-slash string", () => {
		expect(normalizeRoutePath("/")).toBe("/");
		expect(normalizeRoutePath("//")).toBe("/");
		expect(normalizeRoutePath("////")).toBe("/");
	});

	it("strips trailing slashes from a normal route", () => {
		expect(normalizeRoutePath("/about")).toBe("/about");
		expect(normalizeRoutePath("/about/")).toBe("/about");
		expect(normalizeRoutePath("/about///")).toBe("/about");
	});

	it("preserves interior slashes", () => {
		expect(normalizeRoutePath("/a/b/c/")).toBe("/a/b/c");
		expect(normalizeRoutePath("/a//b/")).toBe("/a//b");
	});
});
