// @ts-nocheck
//
import { describe, expect, it } from "vitest";

import {
	normalizeEmail,
	normalizePath,
	normalizeRedirectPath,
	parseIdList,
	serializeIdList,
	slugify,
} from "../src/admin-normalizers";

describe("normalizePath", () => {
	it("returns empty string for empty input", () => {
		expect(normalizePath("")).toBe("");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(normalizePath("   ")).toBe("");
	});

	it("prepends slash when path lacks one", () => {
		expect(normalizePath("about")).toBe("/about");
	});

	it("preserves existing leading slash", () => {
		expect(normalizePath("/about")).toBe("/about");
	});

	it("trims surrounding whitespace before normalizing", () => {
		expect(normalizePath("  /about  ")).toBe("/about");
	});
});

describe("normalizeRedirectPath", () => {
	it("returns empty string for empty input", () => {
		expect(normalizeRedirectPath("")).toBe("");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(normalizeRedirectPath("   ")).toBe("");
	});

	it("rejects protocol-relative URLs (open redirect vector)", () => {
		expect(normalizeRedirectPath("//evil.example.com")).toBe("");
	});

	it("rejects protocol-relative URLs with trailing whitespace trimmed first", () => {
		expect(normalizeRedirectPath("  //evil.example.com/path  ")).toBe("");
	});

	it("prepends slash to relative paths", () => {
		expect(normalizeRedirectPath("dashboard")).toBe("/dashboard");
	});

	it("preserves existing leading slash", () => {
		expect(normalizeRedirectPath("/dashboard")).toBe("/dashboard");
	});
});

describe("normalizeEmail", () => {
	it("lowercases and trims the value", () => {
		expect(normalizeEmail("  Admin@Example.COM  ")).toBe("admin@example.com");
	});
});

describe("slugify", () => {
	it("lowercases, replaces non-alphanumeric runs with hyphens, strips leading/trailing hyphens", () => {
		expect(slugify("Hello World!")).toBe("hello-world");
	});
});

describe("parseIdList", () => {
	it.each([null, undefined, ""])(
		"returns empty array for falsy input: %s",
		(value) => {
			expect(parseIdList(value)).toEqual([]);
		},
	);

	it("throws for invalid JSON string (no outer catch)", () => {
		expect(() => parseIdList("not-json")).toThrow();
	});

	it("returns empty array when JSON is a non-array value", () => {
		expect(parseIdList('{"id":1}')).toEqual([]);
	});

	it("filters out non-integer and non-positive entries", () => {
		expect(parseIdList('["a", -1, 0, 1.5, 2]')).toEqual([2]);
	});

	it("parses a valid array of positive integers", () => {
		expect(parseIdList("[1, 2, 3]")).toEqual([1, 2, 3]);
	});
});

describe("serializeIdList", () => {
	it("serializes a sorted array of positive integers", () => {
		expect(serializeIdList([3, 1, 2])).toBe("[1,2,3]");
	});

	it("filters out non-positive entries before serializing", () => {
		expect(serializeIdList([0, -1, 3, 1])).toBe("[1,3]");
	});

	it("filters out non-integer entries", () => {
		expect(serializeIdList([1.5, 2, 3])).toBe("[2,3]");
	});

	it("returns empty array for all-negative input", () => {
		expect(serializeIdList([-1, -2, -3])).toBe("[]");
	});

	it("returns empty array for empty input", () => {
		expect(serializeIdList([])).toBe("[]");
	});
});

describe("slugify — edge cases", () => {
	it("collapses consecutive non-alphanumeric characters into a single hyphen", () => {
		expect(slugify("hello  world")).toBe("hello-world");
	});

	it("strips leading hyphens from special-char prefix", () => {
		expect(slugify("!hello")).toBe("hello");
	});

	it("strips trailing hyphens from special-char suffix", () => {
		expect(slugify("hello!")).toBe("hello");
	});

	it("strips multiple consecutive trailing hyphens", () => {
		// Kills Regex mutation: -+$ → -$ (only strips one trailing hyphen)
		expect(slugify("hello!!")).toBe("hello");
	});

	it("strips multiple consecutive leading hyphens", () => {
		// Kills Regex mutation: ^-+ → ^- (only strips one leading hyphen)
		expect(slugify("!!hello")).toBe("hello");
	});

	it("strips both leading and trailing hyphens", () => {
		expect(slugify("---hello world---")).toBe("hello-world");
	});

	it("collapses internal runs of hyphens produced by adjacent special chars", () => {
		expect(slugify("hello!!world")).toBe("hello-world");
	});

	it("handles leading and trailing whitespace without explicit trim", () => {
		expect(slugify("  hello  ")).toBe("hello");
	});

	it("returns empty string for all non-alphanumeric input", () => {
		expect(slugify("!!!")).toBe("");
	});

	it("trims whitespace before processing", () => {
		expect(slugify("  hello world  ")).toBe("hello-world");
	});
});

describe("parseIdList — boundary cases", () => {
	it("filters out zero (entry > 0 not >=)", () => {
		expect(parseIdList("[0]")).toEqual([]);
	});

	it("parses mixed valid and invalid values", () => {
		expect(parseIdList("[1, 0, -5, 3]")).toEqual([1, 3]);
	});
});

describe("normalizeEmail — individual transforms", () => {
	it("lowercases without trimming when no whitespace present", () => {
		expect(normalizeEmail("ADMIN@EXAMPLE.COM")).toBe("admin@example.com");
	});

	it("trims without case-folding when already lowercase", () => {
		expect(normalizeEmail("  admin@example.com  ")).toBe("admin@example.com");
	});
});

describe("normalizePath — whitespace without slash", () => {
	it("prepends slash to a path with inner whitespace stripped", () => {
		expect(normalizePath("  about  ")).toBe("/about");
	});
});

describe("normalizeRedirectPath — additional branches", () => {
	it("rejects path that is exactly '//'", () => {
		expect(normalizeRedirectPath("//")).toBe("");
	});

	it("accepts a single slash", () => {
		expect(normalizeRedirectPath("/")).toBe("/");
	});
});
