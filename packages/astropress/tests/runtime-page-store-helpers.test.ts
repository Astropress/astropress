import { describe, expect, it } from "vitest";
import {
	createFallbackReadStore,
	createStaticReadStore,
	normalizeContentStatus,
	type SeededContentRecord,
} from "../src/runtime-page-store-helpers";
import { defaultSiteSettings } from "../src/site-settings";

function seedRecord(over: Partial<SeededContentRecord> = {}): SeededContentRecord {
	return {
		slug: "hello",
		legacyUrl: "/hello",
		title: "Hello",
		templateKey: "content",
		listingItems: [],
		paginationLinks: [],
		sourceHtmlPath: "runtime://content/hello",
		updatedAt: "2025-01-01T00:00:00Z",
		status: "published",
		...over,
	} as SeededContentRecord;
}

describe("normalizeContentStatus", () => {
	it("accepts the four valid statuses unchanged", () => {
		expect(normalizeContentStatus("draft")).toBe("draft");
		expect(normalizeContentStatus("review")).toBe("review");
		expect(normalizeContentStatus("published")).toBe("published");
		expect(normalizeContentStatus("archived")).toBe("archived");
	});

	it("returns 'published' for any unknown / non-string input", () => {
		expect(normalizeContentStatus("unknown")).toBe("published");
		expect(normalizeContentStatus("")).toBe("published");
		expect(normalizeContentStatus(null)).toBe("published");
		expect(normalizeContentStatus(undefined)).toBe("published");
		expect(normalizeContentStatus(42)).toBe("published");
	});
});

describe("createStaticReadStore", () => {
	it("returns empty arrays / no-ops from every non-content section", async () => {
		const store = createStaticReadStore(() => []);
		expect(await store.audit.getAuditEvents()).toEqual([]);
		await expect(
			store.audit.recordAuditEvent({
				event: "test",
				actorEmail: "x",
				actorRole: "admin",
			} as unknown as Parameters<typeof store.audit.recordAuditEvent>[0]),
		).resolves.toBeUndefined();
		expect(await store.users.listAdminUsers()).toEqual([]);
		expect(await store.authors.listAuthors()).toEqual([]);
		expect(await store.taxonomies.listCategories()).toEqual([]);
		expect(await store.taxonomies.listTags()).toEqual([]);
		expect(await store.redirects.getRedirectRules()).toEqual([]);
		expect(await store.comments.getComments()).toEqual([]);
		expect(await store.comments.getApprovedCommentsForRoute("/x")).toEqual([]);
		expect(await store.submissions.getContactSubmissions()).toEqual([]);
		expect(await store.submissions.getTestimonials()).toEqual([]);
		expect(await store.media.listMediaAssets()).toEqual([]);
	});

	it("delegates content.listContentStates to the supplied seeded-records getter on every call", async () => {
		let callCount = 0;
		const store = createStaticReadStore(() => {
			callCount += 1;
			return [seedRecord({ slug: `s-${callCount}` })];
		});
		const first = await store.content.listContentStates();
		const second = await store.content.listContentStates();
		expect((first[0] as SeededContentRecord).slug).toBe("s-1");
		expect((second[0] as SeededContentRecord).slug).toBe("s-2");
	});

	it("content.getContentState matches on slug or on '/<slug>' legacyUrl, else returns null", async () => {
		const records: SeededContentRecord[] = [
			seedRecord({ slug: "about", legacyUrl: "/somewhere-else" }),
			seedRecord({ slug: "by-legacy", legacyUrl: "/contact" }),
		];
		const store = createStaticReadStore(() => records);
		expect((await store.content.getContentState("about"))?.slug).toBe("about");
		// legacyUrl match: lookup key 'contact' → '/contact' matches the legacyUrl
		expect((await store.content.getContentState("contact"))?.slug).toBe("by-legacy");
		expect(await store.content.getContentState("missing")).toBeNull();
	});

	it("content.getContentRevisions always returns null", async () => {
		const store = createStaticReadStore(() => []);
		expect(await store.content.getContentRevisions("anything")).toBeNull();
	});

	it("translations.getEffectiveTranslationState defaults to 'not_started' when no fallback is supplied", async () => {
		const store = createStaticReadStore(() => []);
		expect(await store.translations.getEffectiveTranslationState("/es/x")).toBe("not_started");
		expect(await store.translations.getEffectiveTranslationState("/es/x", "translated")).toBe(
			"translated",
		);
	});

	it("settings.getSettings returns defaultSiteSettings", async () => {
		const store = createStaticReadStore(() => []);
		expect(await store.settings.getSettings()).toEqual(defaultSiteSettings);
	});

	it("rateLimits permit by default and recordFailedAttempt is a no-op", async () => {
		const store = createStaticReadStore(() => []);
		expect(await store.rateLimits.checkRateLimit("k", 1, 1000)).toBe(true);
		expect(await store.rateLimits.peekRateLimit("k", 1, 1000)).toBe(true);
		await expect(store.rateLimits.recordFailedAttempt("k", 1, 1000)).resolves.toBeUndefined();
	});
});

describe("createFallbackReadStore", () => {
	it("falls back to the static read store when localAdminStore is null", async () => {
		const seeded = [seedRecord({ slug: "from-seed" })];
		const store = createFallbackReadStore(null, () => seeded);
		expect((await store.content.listContentStates())[0]?.slug).toBe("from-seed");
		expect(await store.users.listAdminUsers()).toEqual([]);
	});

	it("forwards every section to the local admin store when one is provided", async () => {
		const local = {
			getAuditEvents: () => [{ id: "1" }],
			recordAuditEvent: (input: unknown) => {
				local.lastAudit = input;
			},
			listAdminUsers: () => [
				{ id: "1", email: "a", role: "admin", status: "active", name: "A" },
				// Unknown status must be normalised to "active"
				{ id: "2", email: "b", role: "editor", status: "ghosted", name: "B" },
				{ id: "3", email: "c", role: "editor", status: "invited", name: "C" },
				{ id: "4", email: "d", role: "editor", status: "suspended", name: "D" },
			],
			listAuthors: () => [{ id: 1, slug: "a", name: "A" }],
			listCategories: () => [{ id: 1, slug: "c", name: "C" }],
			listTags: () => [{ id: 1, slug: "t", name: "T" }],
			getRedirectRules: () => [{ source: "/old", destination: "/new" }],
			getComments: () => [
				{ id: "c1", route: "/x", status: "approved", body: "ok" },
				{ id: "c2", route: "/x", status: "pending", body: "no" },
				{ id: "c3", route: "/y", status: "approved", body: "wrong-route" },
			],
			listContentStates: () => [{ slug: "from-local" }],
			getContentState: (slug: string) => ({ slug, source: "local" }),
			getContentRevisions: (slug: string) => [{ id: "rev-1", slug }],
			getContactSubmissions: () => [{ id: "sub-1" }],
			getTestimonials: (status?: string) => [{ id: "t-1", status }],
			getEffectiveTranslationState: (route: string, fallback: string) => `${route}::${fallback}`,
			getSettings: () => ({ ...defaultSiteSettings, siteName: "Local" }),
			listMediaAssets: () => [{ id: "m-1" }],
			lastAudit: undefined as unknown,
		} as unknown as Parameters<typeof createFallbackReadStore>[0] & {
			lastAudit: unknown;
		};

		const store = createFallbackReadStore(local, () => []);

		expect(await store.audit.getAuditEvents()).toEqual([{ id: "1" }]);
		await store.audit.recordAuditEvent({
			event: "x",
		} as unknown as Parameters<typeof store.audit.recordAuditEvent>[0]);
		expect(local.lastAudit).toEqual({ event: "x" });

		const users = await store.users.listAdminUsers();
		expect(users.map((u) => u.status)).toEqual(["active", "active", "invited", "suspended"]);

		expect(await store.authors.listAuthors()).toEqual([{ id: 1, slug: "a", name: "A" }]);
		expect(await store.taxonomies.listCategories()).toEqual([{ id: 1, slug: "c", name: "C" }]);
		expect(await store.taxonomies.listTags()).toEqual([{ id: 1, slug: "t", name: "T" }]);
		expect(await store.redirects.getRedirectRules()).toEqual([
			{ source: "/old", destination: "/new" },
		]);

		const allComments = await store.comments.getComments();
		expect(allComments.map((c) => (c as { id: string }).id)).toEqual(["c1", "c2", "c3"]);

		const approvedForX = await store.comments.getApprovedCommentsForRoute("/x");
		expect(approvedForX.map((c) => (c as { id: string }).id)).toEqual(["c1"]);

		expect((await store.content.listContentStates())[0]?.slug).toBe("from-local");
		const got = await store.content.getContentState("hello-world");
		expect((got as unknown as { source: string })?.source).toBe("local");
		const revs = await store.content.getContentRevisions("rev-slug");
		expect(revs?.[0]?.id).toBe("rev-1");

		expect(await store.submissions.getContactSubmissions()).toEqual([{ id: "sub-1" }]);
		const testimonials = await store.submissions.getTestimonials("pending");
		expect((testimonials[0] as unknown as { status: string }).status).toBe("pending");

		// defaults to "not_started" when caller omits the fallback
		expect(await store.translations.getEffectiveTranslationState("/es/x")).toBe(
			"/es/x::not_started",
		);
		expect(await store.translations.getEffectiveTranslationState("/es/y", "translated")).toBe(
			"/es/y::translated",
		);

		expect((await store.settings.getSettings()).siteName).toBe("Local");

		// rateLimits are still static (always permit) — verify they aren't routed to the local store
		expect(await store.rateLimits.checkRateLimit("k", 1, 1000)).toBe(true);
		expect(await store.rateLimits.peekRateLimit("k", 1, 1000)).toBe(true);
		await expect(store.rateLimits.recordFailedAttempt("k", 1, 1000)).resolves.toBeUndefined();

		expect(await store.media.listMediaAssets()).toEqual([{ id: "m-1" }]);
	});
});
