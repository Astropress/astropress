import { describe, expect, it } from "vitest";

import {
	createD1OperationsMutationPart,
	createD1OperationsReadPart,
} from "../src/d1-store-operations";
import {
	createSeededCloudflareDatabase,
	SqliteBackedD1Database,
} from "./helpers/provider-test-fixtures.js";

async function makeStores() {
	const db = await createSeededCloudflareDatabase();
	const shim = new SqliteBackedD1Database(db);
	return {
		db,
		shim,
		read: createD1OperationsReadPart(shim),
		write: createD1OperationsMutationPart(shim),
	};
}

describe("createD1OperationsReadPart — audit", () => {
	it("getAuditEvents starts empty then reflects a recorded event", async () => {
		const { read } = await makeStores();
		const initial = await read.audit.getAuditEvents();
		expect(initial.length).toBe(0);
		await read.audit.recordAuditEvent({
			userEmail: "u@example.com",
			action: "create",
			resourceType: "post",
			resourceId: "p1",
			summary: "made p1",
		});
		const after = await read.audit.getAuditEvents();
		expect(after.length).toBe(1);
		expect(after[0].actorEmail).toBe("u@example.com");
		expect(after[0].action).toBe("create");
		expect(after[0].summary).toBe("made p1");
	});

	it("recordAuditEvent passes null when resourceId is undefined (pins ?? operand)", async () => {
		const { read } = await makeStores();
		await read.audit.recordAuditEvent({
			userEmail: "u@example.com",
			action: "delete",
			resourceType: "post",
			summary: "no id",
		});
		const events = await read.audit.getAuditEvents();
		// resource_id NULL falls back to row.id stringified per mapPersistedAuditEvent
		expect(events[0].targetId).toBeTruthy();
		expect(events[0].action).toBe("delete");
	});
});

describe("createD1OperationsReadPart — users / redirects / settings", () => {
	it("listAdminUsers returns the seeded admin", async () => {
		const { read } = await makeStores();
		const users = await read.users.listAdminUsers();
		expect(users.length).toBeGreaterThan(0);
		expect(users[0].email).toBe("admin@example.com");
	});

	it("getRedirectRules returns an array (empty for a freshly seeded DB)", async () => {
		const { read } = await makeStores();
		expect(Array.isArray(await read.redirects.getRedirectRules())).toBe(true);
	});

	it("getSettings returns defaultSiteSettings when the table has no row", async () => {
		const { read } = await makeStores();
		const settings = await read.settings.getSettings();
		expect(settings).toBeTruthy();
		expect(typeof settings.siteTitle).toBe("string");
	});
});

describe("createD1OperationsReadPart — comments + getApprovedCommentsForRoute filter", () => {
	it("getComments returns mapped rows; getApprovedCommentsForRoute filters by route+approved", async () => {
		const { db, read } = await makeStores();
		// Seed two comments on different routes / statuses
		db.prepare(
			"INSERT INTO comments (id, route, author, email, body, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("c1", "/a", "A", "a@x", "ba", "approved", "open-moderated", "2026-01-01");
		db.prepare(
			"INSERT INTO comments (id, route, author, email, body, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("c2", "/b", "B", "b@x", "bb", "approved", "open-moderated", "2026-01-02");
		db.prepare(
			"INSERT INTO comments (id, route, author, email, body, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("c3", "/a", "C", "c@x", "bc", "pending", "open-moderated", "2026-01-03");
		const all = await read.comments.getComments();
		expect(all.length).toBe(3);
		const filteredA = await read.comments.getApprovedCommentsForRoute("/a");
		expect(filteredA.length).toBe(1);
		expect(filteredA[0].id).toBe("c1");
		const filteredB = await read.comments.getApprovedCommentsForRoute("/b");
		expect(filteredB.map((c) => c.id)).toEqual(["c2"]);
	});
});

describe("createD1OperationsReadPart — submissions / testimonials", () => {
	it("getContactSubmissions returns mapped rows for inserted contacts", async () => {
		const { read, write } = await makeStores();
		expect((await read.submissions.getContactSubmissions()).length).toBe(0);
		await write.submissions.submitContact({
			name: "N",
			email: "n@x",
			message: "hi",
			submittedAt: "2026-02-02",
		});
		const submissions = await read.submissions.getContactSubmissions();
		expect(submissions.length).toBe(1);
		expect(submissions[0].name).toBe("N");
		expect(submissions[0].email).toBe("n@x");
	});

	it("getTestimonials with no filter returns all rows", async () => {
		const { read, write } = await makeStores();
		const result = await write.submissions.submitTestimonial({
			name: "T1",
			email: "t1@x.com",
			source: "formbricks",
			submittedAt: "2026-03-03",
			consentToPublish: true,
		});
		expect(result.ok).toBe(true);
		const items = await read.submissions.getTestimonials();
		expect(items.length).toBe(1);
	});

	it("getTestimonials with status='pending' filters by status", async () => {
		const { read, write } = await makeStores();
		await write.submissions.submitTestimonial({
			name: "T",
			email: "t@x.com",
			source: "formbricks",
			submittedAt: "2026-04-04",
			consentToPublish: true,
		});
		const pending = await read.submissions.getTestimonials("pending");
		expect(pending.length).toBe(1);
		const approved = await read.submissions.getTestimonials("approved");
		expect(approved.length).toBe(0);
	});
});

describe("createD1OperationsReadPart — translations", () => {
	it("getEffectiveTranslationState returns the row value when present", async () => {
		const { db, read } = await makeStores();
		db.prepare("INSERT INTO translation_overrides (route, state, updated_by) VALUES (?, ?, ?)").run(
			"/about",
			"translated",
			"u@x",
		);
		const state = await read.translations.getEffectiveTranslationState("/about");
		expect(state).toBe("translated");
	});

	it("getEffectiveTranslationState falls back when no row exists", async () => {
		const { read } = await makeStores();
		const state = await read.translations.getEffectiveTranslationState("/missing", "translated");
		expect(state).toBe("translated");
	});

	it("getEffectiveTranslationState defaults the fallback to 'not_started'", async () => {
		const { read } = await makeStores();
		const state = await read.translations.getEffectiveTranslationState("/missing");
		expect(state).toBe("not_started");
	});
});

describe("createD1OperationsReadPart — media", () => {
	it("listMediaAssets returns mapped media rows", async () => {
		const { db, read } = await makeStores();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("m1", "https://cdn/x", "/local/x", "image/png", 42, "alt", "Title", "2026-01-01", "u@x");
		const assets = await read.media.listMediaAssets();
		const mine = assets.find((a) => a.id === "m1");
		expect(mine).toBeTruthy();
		expect(mine?.mimeType).toBe("image/png");
	});
});

describe("createD1OperationsMutationPart — submissions", () => {
	it("submitTestimonial returns { ok:true, id:'testimonial-...' } and persists", async () => {
		const { read, write } = await makeStores();
		const result = await write.submissions.submitTestimonial({
			name: "T",
			email: "t@x.com",
			source: "formbricks",
			submittedAt: "now",
			consentToPublish: true,
		});
		expect(result.ok).toBe(true);
		expect(result.id.startsWith("testimonial-")).toBe(true);
		expect((await read.submissions.getTestimonials()).length).toBe(1);
	});

	it("submitContact returns the submission with a 'contact-' prefixed id", async () => {
		const { write } = await makeStores();
		const result = await write.submissions.submitContact({
			name: "N",
			email: "n@x.com",
			message: "hi",
			submittedAt: "2026-01-01",
		});
		expect(result.ok).toBe(true);
		expect(result.submission.id.startsWith("contact-")).toBe(true);
		expect(result.submission.name).toBe("N");
	});

	it("moderateTestimonial returns ok:false when the id is unknown", async () => {
		const { write } = await makeStores();
		const result = await write.submissions.moderateTestimonial("missing-id", "approved", "a@x.com");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe("Testimonial not found");
	});

	it("moderateTestimonial returns ok:true after a successful update", async () => {
		const { write } = await makeStores();
		const submitted = await write.submissions.submitTestimonial({
			name: "T",
			email: "t@x.com",
			source: "formbricks",
			submittedAt: "2026-01-01",
			consentToPublish: true,
		});
		const result = await write.submissions.moderateTestimonial(submitted.id, "approved", "a@x.com");
		expect(result.ok).toBe(true);
	});
});

describe("createD1OperationsMutationPart — comments", () => {
	it("submitPublicComment returns a pending comment with the 'public-' id prefix", async () => {
		const { read, write } = await makeStores();
		const result = await write.comments.submitPublicComment({
			author: "A",
			email: "a@x",
			body: "hi",
			route: "/r",
		});
		expect(result.ok).toBe(true);
		expect(result.comment.id.startsWith("public-")).toBe(true);
		expect(result.comment.status).toBe("pending");
		expect(result.comment.policy).toBe("open-moderated");
		expect(result.comment.submittedAt).toBeTruthy();
		expect((await read.comments.getComments()).length).toBe(1);
	});

	it("submitPublicComment uses input.submittedAt when provided (pins || operand)", async () => {
		const { write } = await makeStores();
		const result = await write.comments.submitPublicComment({
			author: "A",
			email: "a@x",
			body: "hi",
			route: "/r",
			submittedAt: "2026-09-09T00:00:00.000Z",
		});
		expect(result.comment.submittedAt).toBe("2026-09-09T00:00:00.000Z");
	});

	it("submitPublicComment falls back to new Date().toISOString() when input.submittedAt is empty", async () => {
		const { write } = await makeStores();
		const result = await write.comments.submitPublicComment({
			author: "A",
			email: "a@x",
			body: "hi",
			route: "/r",
			submittedAt: "",
		});
		expect(result.comment.submittedAt).not.toBe("");
		expect(typeof result.comment.submittedAt).toBe("string");
	});
});

describe("rateLimits part is wired on both read and mutation factories", () => {
	it("createD1OperationsReadPart exposes rateLimits", async () => {
		const { read } = await makeStores();
		expect(read.rateLimits).toBeTruthy();
	});
	it("createD1OperationsMutationPart exposes rateLimits", async () => {
		const { write } = await makeStores();
		expect(write.rateLimits).toBeTruthy();
	});
});
