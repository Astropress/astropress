import { describe, expect, it } from "vitest";

import {
  normalizePath,
  normalizeRedirectPath,
  normalizeEmail,
  slugify,
  parseIdList,
  serializeIdList,
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
  it.each([null, undefined, ""])("returns empty array for falsy input: %s", (value) => {
    expect(parseIdList(value)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseIdList("not-json")).toEqual([]);
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
});
