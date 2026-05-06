import { describe, expect, it } from "vitest";

import {
	getSeededAdminContentType,
	isSeededPageRecord,
	isSeededPostRecord,
} from "../src/seeded-content-type";

describe("getSeededAdminContentType", () => {
	it("returns 'post' when kind === 'post'", () => {
		expect(getSeededAdminContentType({ kind: "post" })).toBe("post");
	});

	it("returns 'post' when templateKey === 'post' (kind absent)", () => {
		expect(getSeededAdminContentType({ templateKey: "post" })).toBe("post");
	});

	it("returns 'post' when templateKey === 'content' (kind absent)", () => {
		expect(getSeededAdminContentType({ templateKey: "content" })).toBe("post");
	});

	it("returns 'page' when kind is 'page' and templateKey is unrelated", () => {
		expect(getSeededAdminContentType({ kind: "page", templateKey: "landing" })).toBe("page");
	});

	it("returns 'page' for an empty record (no signals)", () => {
		expect(getSeededAdminContentType({})).toBe("page");
	});

	it("returns 'page' when kind is null and templateKey is null", () => {
		expect(getSeededAdminContentType({ kind: null, templateKey: null })).toBe("page");
	});

	it("returns 'page' when templateKey is some other value", () => {
		expect(getSeededAdminContentType({ templateKey: "not-content" })).toBe("page");
	});

	it("does NOT match templateKey strictly equal — only 'post' or 'content' count", () => {
		// Pins the StringLiteral mutations on "post" and "content".
		expect(getSeededAdminContentType({ templateKey: "Post" })).toBe("page");
		expect(getSeededAdminContentType({ templateKey: "Content" })).toBe("page");
	});

	it("does NOT match kind strictly equal — only 'post' counts", () => {
		expect(getSeededAdminContentType({ kind: "Post" })).toBe("page");
	});
});

describe("isSeededPostRecord", () => {
	it("returns true for posts", () => {
		expect(isSeededPostRecord({ kind: "post" })).toBe(true);
		expect(isSeededPostRecord({ templateKey: "post" })).toBe(true);
		expect(isSeededPostRecord({ templateKey: "content" })).toBe(true);
	});

	it("returns false for pages", () => {
		expect(isSeededPostRecord({})).toBe(false);
		expect(isSeededPostRecord({ kind: "page" })).toBe(false);
	});
});

describe("isSeededPageRecord", () => {
	it("returns true for pages", () => {
		expect(isSeededPageRecord({})).toBe(true);
		expect(isSeededPageRecord({ kind: "page" })).toBe(true);
	});

	it("returns false for posts", () => {
		expect(isSeededPageRecord({ kind: "post" })).toBe(false);
		expect(isSeededPageRecord({ templateKey: "post" })).toBe(false);
		expect(isSeededPageRecord({ templateKey: "content" })).toBe(false);
	});
});
