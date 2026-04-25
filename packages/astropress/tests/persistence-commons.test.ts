import { describe, expect, it } from "vitest";

import {
	type PersistedAdminUserRow,
	type PersistedAuditEventRow,
	SQL_LIST_ADMIN_USERS_WITH_INVITE,
	SQL_LIST_AUDIT_EVENTS,
	auditSchemaFields,
	buildAuditEntry,
	deriveAdminUserStatus,
	mapPersistedAdminUserRow,
	mapPersistedAuditEvent,
	mapPersistedOverrideRow,
	normalizeContentStatus,
	normalizeRedirectTarget,
	normalizeSlug,
	parseIdList,
	parseMetadataJson,
	serializeIdList,
	toContentStoreRecord,
	toRedirectRecord,
	validateContentRecord,
} from "../src/persistence-commons";

describe("normalizeSlug", () => {
	it("lowercases input", () => {
		expect(normalizeSlug("ABC")).toBe("abc");
	});
	it("trims surrounding whitespace before processing", () => {
		// If trim() were dropped, leading/trailing space would survive; assert exact.
		expect(normalizeSlug("  hello  ")).toBe("hello");
	});
	it("collapses any non-alphanumeric run into a single hyphen", () => {
		expect(normalizeSlug("a--b___c")).toBe("a-b-c");
		expect(normalizeSlug("Hello, World!")).toBe("hello-world");
	});
	it("returns empty for fully non-alphanumeric input", () => {
		expect(normalizeSlug("!!!")).toBe("");
	});
});

describe("normalizeRedirectTarget", () => {
	it("returns empty string for empty/whitespace input", () => {
		expect(normalizeRedirectTarget("")).toBe("");
		expect(normalizeRedirectTarget("   ")).toBe("");
	});
	it("rejects protocol-relative URLs (open-redirect guard)", () => {
		expect(normalizeRedirectTarget("//evil.example/path")).toBe("");
	});
	it("returns absolute paths unchanged", () => {
		expect(normalizeRedirectTarget("/ok")).toBe("/ok");
	});
	it("prepends a leading slash to relative paths", () => {
		expect(normalizeRedirectTarget("ok")).toBe("/ok");
	});
});

describe("normalizeContentStatus", () => {
	it("returns 'draft' unchanged", () => {
		expect(normalizeContentStatus("draft")).toBe("draft");
	});
	it("returns 'review' unchanged", () => {
		expect(normalizeContentStatus("review")).toBe("review");
	});
	it("returns 'archived' unchanged", () => {
		expect(normalizeContentStatus("archived")).toBe("archived");
	});
	// 'published' is intentionally not asserted as a positive case here — it is
	// also the fallback, so any mutant that swaps the literal still produces
	// "published" for the input "published" (an equivalent mutant).
	it("defaults null to published", () => {
		expect(normalizeContentStatus(null)).toBe("published");
	});
	it("defaults undefined to published", () => {
		expect(normalizeContentStatus(undefined)).toBe("published");
	});
	it("defaults arbitrary strings to published", () => {
		expect(normalizeContentStatus("nonsense")).toBe("published");
	});
	it("treats casing differences as invalid (default to published)", () => {
		expect(normalizeContentStatus("DRAFT")).toBe("published");
	});
});

describe("parseIdList", () => {
	it.each([null, undefined, ""])("returns [] for falsy input %s", (value) => {
		expect(parseIdList(value)).toEqual([]);
	});
	it("returns [] for invalid JSON", () => {
		expect(parseIdList("not-json")).toEqual([]);
	});
	it("returns [] when parsed value is not an array", () => {
		expect(parseIdList('{"id":1}')).toEqual([]);
	});
	it("filters out non-integer and non-positive entries", () => {
		expect(parseIdList('["a", -1, 0, 1.5, 2]')).toEqual([2]);
	});
	it("preserves order from input (no implicit sort)", () => {
		expect(parseIdList("[3, 1, 2]")).toEqual([3, 1, 2]);
	});
});

describe("serializeIdList", () => {
	it("returns empty array JSON for empty input", () => {
		expect(serializeIdList([])).toBe("[]");
	});
	it("filters non-integer / non-positive entries", () => {
		expect(serializeIdList([1.5, -1, 0, 2])).toBe("[2]");
	});
	it("sorts ascending so equal sets serialize identically", () => {
		expect(serializeIdList([3, 1, 2])).toBe("[1,2,3]");
	});
});

describe("validateContentRecord", () => {
	it("accepts records with non-empty slug + title and no status", () => {
		expect(validateContentRecord({ slug: "a", title: "A" })).toEqual({
			ok: true,
		});
	});
	it("accepts records with a valid status", () => {
		expect(
			validateContentRecord({ slug: "a", title: "A", status: "draft" }).ok,
		).toBe(true);
	});
	it("rejects non-string slug with the slug error message", () => {
		const r = validateContentRecord({ slug: 123 as unknown, title: "A" });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty slug");
	});
	it("rejects empty slug with the slug error message", () => {
		const r = validateContentRecord({ slug: "", title: "A" });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty slug");
	});
	it("rejects whitespace-only slug with the slug error message", () => {
		const r = validateContentRecord({ slug: "   ", title: "A" });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty slug");
	});
	it("rejects non-string title with the title error message", () => {
		const r = validateContentRecord({ slug: "a", title: 1 as unknown });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty title");
	});
	it("rejects empty title with the title error message", () => {
		const r = validateContentRecord({ slug: "a", title: "" });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty title");
	});
	it("rejects whitespace-only title with the title error message", () => {
		const r = validateContentRecord({ slug: "a", title: "   " });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Content record requires a non-empty title");
	});
	it("rejects unknown status string and includes the offending value in the message", () => {
		const r = validateContentRecord({ slug: "a", title: "A", status: "bogus" });
		expect(r.ok).toBe(false);
		expect(r.error).toBe("Invalid content status: bogus");
	});
	it("permits null status (treated as absent)", () => {
		expect(
			validateContentRecord({ slug: "a", title: "A", status: null }).ok,
		).toBe(true);
	});
	it("permits undefined status (treated as absent)", () => {
		expect(
			validateContentRecord({ slug: "a", title: "A", status: undefined }).ok,
		).toBe(true);
	});
	it("permits non-string status (the type guard skips validation)", () => {
		// status check requires `typeof === "string"`. Numbers fall through OK.
		expect(
			validateContentRecord({ slug: "a", title: "A", status: 1 as unknown }).ok,
		).toBe(true);
	});
});

describe("buildAuditEntry", () => {
	it("maps actor.email into userEmail", () => {
		const entry = buildAuditEntry({
			actor: { email: "user@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
		});
		expect(entry.userEmail).toBe("user@example.com");
	});
	it("passes action / resourceType / summary through unchanged", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "publish",
			resourceType: "content",
			summary: "ok",
		});
		expect(entry.action).toBe("publish");
		expect(entry.resourceType).toBe("content");
		expect(entry.summary).toBe("ok");
	});
	it("preserves a string resourceId", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			resourceId: "post-1",
			summary: "z",
		});
		expect(entry.resourceId).toBe("post-1");
	});
	it("nulls a missing resourceId", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
		});
		expect(entry.resourceId).toBeNull();
	});
	it("nulls an explicit-null resourceId", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			resourceId: null,
			summary: "z",
		});
		expect(entry.resourceId).toBeNull();
	});
	it("JSON-stringifies a details object", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
			details: { note: "ok", count: 2 },
		});
		expect(entry.details).toBe(JSON.stringify({ note: "ok", count: 2 }));
	});
	it("nulls missing details", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
		});
		expect(entry.details).toBeNull();
	});
	it("nulls explicit-null details", () => {
		const entry = buildAuditEntry({
			actor: { email: "e@example.com" },
			action: "x",
			resourceType: "y",
			summary: "z",
			details: null,
		});
		expect(entry.details).toBeNull();
	});
});

describe("auditSchemaFields", () => {
	it("matches the audit_events column order used by the INSERT statements", () => {
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

describe("parseMetadataJson", () => {
	it("returns undefined for null", () => {
		expect(parseMetadataJson(null)).toBeUndefined();
	});
	it("returns undefined for undefined", () => {
		expect(parseMetadataJson(undefined)).toBeUndefined();
	});
	it("returns undefined for malformed JSON", () => {
		expect(parseMetadataJson("not-json")).toBeUndefined();
	});
	it("returns undefined when parsed value is null (literal 'null')", () => {
		expect(parseMetadataJson("null")).toBeUndefined();
	});
	it("returns undefined when parsed value is a primitive", () => {
		expect(parseMetadataJson("42")).toBeUndefined();
		expect(parseMetadataJson('"hello"')).toBeUndefined();
		expect(parseMetadataJson("true")).toBeUndefined();
	});
	it("returns undefined when parsed value is an array", () => {
		expect(parseMetadataJson("[1, 2]")).toBeUndefined();
	});
	it("returns the parsed object for a valid JSON object", () => {
		expect(parseMetadataJson('{"extra": 1}')).toEqual({ extra: 1 });
	});
});

describe("mapPersistedOverrideRow", () => {
	const baseRow = {
		title: "T",
		status: "draft" as const,
		scheduled_at: null,
		body: null,
		seo_title: "S",
		meta_description: "M",
		excerpt: null,
		og_title: null,
		og_description: null,
		og_image: null,
		canonical_url_override: null,
		robots_directive: null,
	};

	it("returns null for null input", () => {
		expect(mapPersistedOverrideRow(null)).toBeNull();
	});
	it("returns null for undefined input", () => {
		expect(mapPersistedOverrideRow(undefined)).toBeNull();
	});
	it("maps required scalar fields verbatim", () => {
		const r = mapPersistedOverrideRow(baseRow);
		expect(r).toMatchObject({
			title: "T",
			status: "draft",
			seoTitle: "S",
			metaDescription: "M",
		});
	});
	it("converts null scheduled_at to undefined (not preserved as null)", () => {
		expect(mapPersistedOverrideRow(baseRow)?.scheduledAt).toBeUndefined();
	});
	it("preserves a non-null scheduled_at", () => {
		const r = mapPersistedOverrideRow({
			...baseRow,
			scheduled_at: "2026-01-01",
		});
		expect(r?.scheduledAt).toBe("2026-01-01");
	});
	it("preserves a non-null body", () => {
		expect(mapPersistedOverrideRow({ ...baseRow, body: "hello" })?.body).toBe(
			"hello",
		);
	});
	it("preserves a non-null excerpt", () => {
		expect(
			mapPersistedOverrideRow({ ...baseRow, excerpt: "ex" })?.excerpt,
		).toBe("ex");
	});
	it("preserves non-null og_* fields", () => {
		const r = mapPersistedOverrideRow({
			...baseRow,
			og_title: "OT",
			og_description: "OD",
			og_image: "OI",
		});
		expect(r?.ogTitle).toBe("OT");
		expect(r?.ogDescription).toBe("OD");
		expect(r?.ogImage).toBe("OI");
	});
	it("preserves canonical_url_override and robots_directive", () => {
		const r = mapPersistedOverrideRow({
			...baseRow,
			canonical_url_override: "/canonical",
			robots_directive: "noindex",
		});
		expect(r?.canonicalUrlOverride).toBe("/canonical");
		expect(r?.robotsDirective).toBe("noindex");
	});
	it("omits the metadata key when row.metadata is null/undefined", () => {
		expect(mapPersistedOverrideRow(baseRow)).not.toHaveProperty("metadata");
	});
	it("parses a valid metadata JSON string", () => {
		const r = mapPersistedOverrideRow({
			...baseRow,
			metadata: JSON.stringify({ extra: 1 }),
		});
		expect(r?.metadata).toEqual({ extra: 1 });
	});
	it("drops invalid metadata JSON without throwing", () => {
		const r = mapPersistedOverrideRow({ ...baseRow, metadata: "not-json" });
		expect(r?.metadata).toBeUndefined();
	});
});

describe("toContentStoreRecord", () => {
	const base = {
		slug: "a",
		title: "A",
		seoTitle: "ST",
		metaDescription: "MD",
		updatedAt: "2026-01-01",
		legacyUrl: "/a",
		templateKey: "default",
	};

	it("maps a published record with kind=post", () => {
		const r = toContentStoreRecord({
			...base,
			kind: "post",
			status: "published",
		});
		expect(r.kind).toBe("post");
		expect(r.status).toBe("published");
		expect(r.id).toBe("a");
		expect(r.slug).toBe("a");
		expect(r.title).toBe("A");
	});
	it("treats kind other than 'post' as 'page' (including null/undefined)", () => {
		expect(
			toContentStoreRecord({ ...base, kind: null, status: "draft" }).kind,
		).toBe("page");
		expect(
			toContentStoreRecord({ ...base, kind: "anything", status: "draft" }).kind,
		).toBe("page");
	});
	it("collapses 'review' to 'draft' on the way out", () => {
		expect(toContentStoreRecord({ ...base, status: "review" }).status).toBe(
			"draft",
		);
	});
	it("preserves 'draft' / 'archived' verbatim", () => {
		expect(toContentStoreRecord({ ...base, status: "draft" }).status).toBe(
			"draft",
		);
		expect(toContentStoreRecord({ ...base, status: "archived" }).status).toBe(
			"archived",
		);
	});
	it("nulls a missing body", () => {
		expect(toContentStoreRecord({ ...base, status: "draft" }).body).toBeNull();
	});
	it("preserves a provided body", () => {
		expect(
			toContentStoreRecord({ ...base, status: "draft", body: "hi" }).body,
		).toBe("hi");
	});
	it("populates the metadata object with all six fields, defaulting summary to ''", () => {
		const r = toContentStoreRecord({ ...base, status: "draft" });
		expect(r.metadata).toEqual({
			seoTitle: "ST",
			metaDescription: "MD",
			updatedAt: "2026-01-01",
			legacyUrl: "/a",
			templateKey: "default",
			summary: "",
		});
	});
	it("preserves a provided summary in metadata", () => {
		const r = toContentStoreRecord({
			...base,
			status: "draft",
			summary: "hello",
		});
		expect(r.metadata.summary).toBe("hello");
	});
});

describe("toRedirectRecord", () => {
	it("shapes the record with id=slug=title=sourcePath", () => {
		const r = toRedirectRecord({
			sourcePath: "/old",
			targetPath: "/new",
			statusCode: 301,
		});
		expect(r.id).toBe("/old");
		expect(r.slug).toBe("/old");
		expect(r.title).toBe("/old");
	});
	it("uses a literal 'redirect' kind and 'published' status", () => {
		const r = toRedirectRecord({
			sourcePath: "/old",
			targetPath: "/new",
			statusCode: 301,
		});
		expect(r.kind).toBe("redirect");
		expect(r.status).toBe("published");
	});
	it("carries targetPath and statusCode in metadata", () => {
		const r = toRedirectRecord({
			sourcePath: "/old",
			targetPath: "/new",
			statusCode: 302,
		});
		expect(r.metadata).toEqual({ targetPath: "/new", statusCode: 302 });
	});
});

describe("SQL_LIST_AUDIT_EVENTS / SQL_LIST_ADMIN_USERS_WITH_INVITE", () => {
	it("audit-events query orders by created_at desc, id desc", () => {
		expect(SQL_LIST_AUDIT_EVENTS).toContain("FROM audit_events");
		expect(SQL_LIST_AUDIT_EVENTS).toMatch(
			/ORDER BY datetime\(created_at\) DESC, id DESC/,
		);
	});

	it("admin-users query joins user_invites for has_pending_invite and orders admins first", () => {
		expect(SQL_LIST_ADMIN_USERS_WITH_INVITE).toContain("FROM admin_users");
		expect(SQL_LIST_ADMIN_USERS_WITH_INVITE).toContain("user_invites");
		expect(SQL_LIST_ADMIN_USERS_WITH_INVITE).toContain("has_pending_invite");
		expect(SQL_LIST_ADMIN_USERS_WITH_INVITE).toMatch(
			/CASE role WHEN 'admin' THEN 0 ELSE 1 END/,
		);
	});
});

describe("deriveAdminUserStatus", () => {
	it("returns 'suspended' when active is not 1", () => {
		expect(deriveAdminUserStatus(0, 0)).toBe("suspended");
		expect(deriveAdminUserStatus(0, 1)).toBe("suspended");
	});
	it("returns 'invited' when active and has_pending_invite is 1", () => {
		expect(deriveAdminUserStatus(1, 1)).toBe("invited");
	});
	it("returns 'active' when active and no pending invite", () => {
		expect(deriveAdminUserStatus(1, 0)).toBe("active");
	});
});

describe("mapPersistedAdminUserRow", () => {
	const row: PersistedAdminUserRow = {
		id: 7,
		email: "ada@example.test",
		role: "admin",
		name: "Ada",
		active: 1,
		created_at: "2026-04-25T00:00:00Z",
		has_pending_invite: 0,
	};

	it("maps every field and derives boolean active + status", () => {
		expect(mapPersistedAdminUserRow(row)).toEqual({
			id: 7,
			email: "ada@example.test",
			role: "admin",
			name: "Ada",
			active: true,
			status: "active",
			createdAt: "2026-04-25T00:00:00Z",
		});
	});

	it("propagates 'invited' status when has_pending_invite is 1", () => {
		expect(
			mapPersistedAdminUserRow({ ...row, has_pending_invite: 1 }).status,
		).toBe("invited");
	});

	it("returns 'suspended' when active is 0 regardless of invite", () => {
		expect(
			mapPersistedAdminUserRow({ ...row, active: 0, has_pending_invite: 1 })
				.status,
		).toBe("suspended");
	});
});

describe("mapPersistedAuditEvent", () => {
	const baseRow: PersistedAuditEventRow = {
		id: 42,
		user_email: "ada@example.test",
		action: "publish",
		resource_type: "content",
		resource_id: "post-1",
		summary: "Published post",
		created_at: "2026-04-25T00:00:00Z",
	};

	it("namespaces id with the supplied prefix to avoid cross-store collisions", () => {
		expect(
			mapPersistedAuditEvent({ row: baseRow, idPrefix: "d1-audit-" }).id,
		).toBe("d1-audit-42");
		expect(
			mapPersistedAuditEvent({ row: baseRow, idPrefix: "sqlite-audit-" }).id,
		).toBe("sqlite-audit-42");
	});

	it("maps known target types verbatim", () => {
		for (const t of ["redirect", "comment", "content"] as const) {
			expect(
				mapPersistedAuditEvent({
					row: { ...baseRow, resource_type: t },
					idPrefix: "x-",
				}).targetType,
			).toBe(t);
		}
	});

	it("falls back to 'auth' for unknown target types", () => {
		expect(
			mapPersistedAuditEvent({
				row: { ...baseRow, resource_type: "session" },
				idPrefix: "x-",
			}).targetType,
		).toBe("auth");
	});

	it("falls back to stringified id when resource_id is null", () => {
		expect(
			mapPersistedAuditEvent({
				row: { ...baseRow, resource_id: null },
				idPrefix: "x-",
			}).targetId,
		).toBe("42");
	});
});
