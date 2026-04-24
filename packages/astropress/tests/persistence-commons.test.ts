import { describe, expect, it } from "vitest";

import {
	auditSchemaFields,
	buildAuditEntry,
	mapPersistedOverrideRow,
	normalizeContentStatus,
	normalizeRedirectTarget,
	normalizeSlug,
	parseIdList,
	serializeIdList,
	toContentStoreRecord,
	toRedirectRecord,
	validateContentRecord,
} from "../src/persistence-commons";

describe("normalizeSlug", () => {
	it("lowercases, trims, and collapses separators", () => {
		expect(normalizeSlug("  Hello, World! ")).toBe("hello-world");
		expect(normalizeSlug("a--b___c")).toBe("a-b-c");
	});
});

describe("normalizeRedirectTarget", () => {
	it("rejects protocol-relative URLs", () => {
		expect(normalizeRedirectTarget("//evil.example/path")).toBe("");
	});
	it("passes absolute paths through", () => {
		expect(normalizeRedirectTarget("/ok")).toBe("/ok");
		expect(normalizeRedirectTarget("ok")).toBe("/ok");
	});
});

describe("normalizeContentStatus", () => {
	it("accepts the four canonical statuses", () => {
		for (const s of ["draft", "review", "published", "archived"] as const) {
			expect(normalizeContentStatus(s)).toBe(s);
		}
	});
	it("defaults unknown values to published", () => {
		expect(normalizeContentStatus(null)).toBe("published");
		expect(normalizeContentStatus("nonsense")).toBe("published");
	});
});

describe("parseIdList / serializeIdList", () => {
	it("parses JSON arrays, filters non-positive-integer entries", () => {
		expect(parseIdList('["a", -1, 0, 1.5, 2]')).toEqual([2]);
	});
	it("is defensive against malformed JSON", () => {
		expect(parseIdList("not-json")).toEqual([]);
	});
	it("serializeIdList sorts and filters", () => {
		expect(serializeIdList([3, -1, 0, 2, 1])).toBe("[1,2,3]");
	});
});

describe("validateContentRecord", () => {
	it("accepts valid records", () => {
		expect(validateContentRecord({ slug: "a", title: "A" }).ok).toBe(true);
	});
	it("rejects empty slug/title", () => {
		expect(validateContentRecord({ slug: "", title: "A" }).ok).toBe(false);
		expect(validateContentRecord({ slug: "a", title: "" }).ok).toBe(false);
	});
	it("rejects unknown status", () => {
		const result = validateContentRecord({
			slug: "a",
			title: "A",
			status: "bogus",
		});
		expect(result.ok).toBe(false);
	});
});

describe("buildAuditEntry", () => {
	it("produces the shared audit schema shape", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "publish",
			resourceType: "content",
			resourceId: "post-1",
			summary: "published",
			details: { note: "ok" },
		});
		expect(entry).toEqual({
			userEmail: "e@example.com",
			action: "publish",
			resourceType: "content",
			resourceId: "post-1",
			summary: "published",
			details: JSON.stringify({ note: "ok" }),
		});
	});
	it("nulls out optional fields", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
		});
		expect(entry.resourceId).toBeNull();
		expect(entry.details).toBeNull();
	});
	it("auditSchemaFields matches the bind order", () => {
		expect(auditSchemaFields).toEqual([
			"user_email",
			"action",
			"resource_type",
			"resource_id",
			"summary",
			"details",
		]);
	});
});

describe("mapPersistedOverrideRow", () => {
	it("returns null for nullish rows", () => {
		expect(mapPersistedOverrideRow(null)).toBeNull();
		expect(mapPersistedOverrideRow(undefined)).toBeNull();
	});
	it("parses metadata JSON when present", () => {
		const result = mapPersistedOverrideRow({
			title: "T",
			status: "draft",
			scheduled_at: null,
			body: null,
			seo_title: "T",
			meta_description: "",
			excerpt: null,
			og_title: null,
			og_description: null,
			og_image: null,
			canonical_url_override: null,
			robots_directive: null,
			metadata: JSON.stringify({ extra: 1 }),
		});
		expect(result?.metadata).toEqual({ extra: 1 });
	});
	it("silently drops invalid metadata JSON", () => {
		const result = mapPersistedOverrideRow({
			title: "T",
			status: "draft",
			scheduled_at: null,
			body: null,
			seo_title: "T",
			meta_description: "",
			excerpt: null,
			og_title: null,
			og_description: null,
			og_image: null,
			canonical_url_override: null,
			robots_directive: null,
			metadata: "not-json",
		});
		expect(result?.metadata).toBeUndefined();
	});
});

describe("toContentStoreRecord / toRedirectRecord", () => {
	it("maps content record fields and collapses review → draft", () => {
		const result = toContentStoreRecord({
			slug: "a",
			title: "A",
			status: "review",
			seoTitle: "A",
			metaDescription: "",
			updatedAt: "2026-01-01",
			legacyUrl: "/a",
			templateKey: "default",
		});
		expect(result.status).toBe("draft");
		expect(result.metadata.templateKey).toBe("default");
	});
	it("shapes redirect records", () => {
		const r = toRedirectRecord({
			sourcePath: "/old",
			targetPath: "/new",
			statusCode: 301,
		});
		expect(r).toEqual({
			id: "/old",
			kind: "redirect",
			slug: "/old",
			status: "published",
			title: "/old",
			metadata: { targetPath: "/new", statusCode: 301 },
		});
	});
});
