import { describe, expect, it, vi } from "vitest";
import {
	createAstropressCommentRepository,
	hashCommentEmail,
} from "../src/comment-repository-factory";
import { createKmacDigest } from "../src/crypto-primitives";
import type { CommentRecord } from "../src/persistence-types";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

function comment(overrides: Partial<CommentRecord> = {}): CommentRecord {
	return {
		id: "c1",
		author: "Alice",
		body: "Hello",
		route: "/blog/post",
		status: "approved",
		policy: "open-moderated",
		submittedAt: "2025-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeRepo(
	overrides: Partial<Parameters<typeof createAstropressCommentRepository>[0]> = {},
) {
	const defaults = {
		getComments: vi.fn(() => [comment()]),
		getCommentRoute: vi.fn(() => "/blog/post"),
		updateCommentStatus: vi.fn(() => true),
		insertPublicComment: vi.fn(() => "2025-01-02T00:00:00.000Z"),
		recordCommentAudit: vi.fn(),
	};
	const merged = { ...defaults, ...overrides };
	const repository = createAstropressCommentRepository(merged);
	return {
		repository,
		recordCommentAudit: merged.recordCommentAudit,
		updateCommentStatus: merged.updateCommentStatus,
		insertPublicComment: merged.insertPublicComment,
		getCommentRoute: merged.getCommentRoute,
		getComments: merged.getComments,
	};
}

describe("comment repository factory — moderate", () => {
	it("dispatches updateCommentStatus and a comment.moderate audit using the resolved route", () => {
		const { repository, updateCommentStatus, recordCommentAudit } = makeRepo({
			getCommentRoute: vi.fn(() => "/services"),
		});
		const result = repository.moderateComment("c1", "rejected", actor);
		expect(result).toEqual({ ok: true });
		expect(updateCommentStatus).toHaveBeenCalledWith("c1", "rejected");
		expect(recordCommentAudit).toHaveBeenCalledWith({
			actor,
			action: "comment.moderate",
			summary: "Marked /services as rejected.",
			targetId: "c1",
		});
	});

	it("returns the not-found error when getCommentRoute returns null and skips the audit", () => {
		const { repository, updateCommentStatus, recordCommentAudit } = makeRepo({
			getCommentRoute: vi.fn(() => null),
		});
		const result = repository.moderateComment("missing", "approved", actor);
		expect(result).toEqual({
			ok: false,
			error: "The selected comment record could not be found.",
		});
		expect(updateCommentStatus).not.toHaveBeenCalled();
		expect(recordCommentAudit).not.toHaveBeenCalled();
	});

	it("returns the not-found error when getCommentRoute returns undefined", () => {
		const { repository } = makeRepo({ getCommentRoute: vi.fn(() => undefined) });
		const result = repository.moderateComment("missing", "approved", actor);
		expect(result).toEqual({
			ok: false,
			error: "The selected comment record could not be found.",
		});
	});

	it("returns the not-found error when getCommentRoute returns the empty string (falsy)", () => {
		const { repository } = makeRepo({ getCommentRoute: vi.fn(() => "") });
		const result = repository.moderateComment("missing", "approved", actor);
		expect(result.ok).toBe(false);
	});
});

describe("comment repository factory — submitPublicComment", () => {
	it("stamps pending status + open-moderated policy and bubbles submittedAt from insertPublicComment", async () => {
		const { repository, insertPublicComment } = makeRepo({
			insertPublicComment: vi.fn(() => "2030-09-09T09:09:09.000Z"),
		});
		const result = await repository.submitPublicComment({
			id: "ignored",
			author: "Bob",
			email: "bob@example.com",
			body: "Nice post",
			route: "/blog/post",
			status: "approved",
			policy: "open-moderated",
			submittedAt: "2025-01-02T00:00:00.000Z",
		});
		expect(result.ok).toBe(true);
		if (result.ok === true) {
			expect(result.comment.status).toBe("pending");
			expect(result.comment.policy).toBe("open-moderated");
			expect(result.comment.submittedAt).toBe("2030-09-09T09:09:09.000Z");
			expect(result.comment.id).toMatch(/^public-/);
		}
		expect(insertPublicComment).toHaveBeenCalledTimes(1);
	});

	it("hashes the author email when sessionSalt is provided", async () => {
		const { repository, insertPublicComment } = makeRepo({ sessionSalt: "site-salt" });
		const result = await repository.submitPublicComment({
			id: "ignored",
			author: "Bob",
			email: "bob@example.com",
			body: "x",
			route: "/r",
			status: "approved",
			policy: "open-moderated",
			submittedAt: "2025-01-02T00:00:00.000Z",
		});
		expect(result.ok).toBe(true);
		const captured = insertPublicComment.mock.calls[0]?.[0] as CommentRecord;
		expect(captured.email).not.toBe("bob@example.com");
		expect(captured.email).toMatch(/^[0-9a-f]+$/i);
		expect(await hashCommentEmail("bob@example.com", "site-salt")).toBe(captured.email);
	});

	it("preserves the raw email when no sessionSalt is provided", async () => {
		const { repository, insertPublicComment } = makeRepo();
		await repository.submitPublicComment({
			id: "ignored",
			author: "Bob",
			email: "bob@example.com",
			body: "x",
			route: "/r",
			status: "approved",
			policy: "open-moderated",
			submittedAt: "2025-01-02T00:00:00.000Z",
		});
		const captured = insertPublicComment.mock.calls[0]?.[0] as CommentRecord;
		expect(captured.email).toBe("bob@example.com");
	});

	it("preserves an undefined email even when sessionSalt is provided (no hash attempted on empty input)", async () => {
		const { repository, insertPublicComment } = makeRepo({ sessionSalt: "site-salt" });
		await repository.submitPublicComment({
			id: "ignored",
			author: "Bob",
			body: "x",
			route: "/r",
			status: "approved",
			policy: "open-moderated",
			submittedAt: "2025-01-02T00:00:00.000Z",
		});
		const captured = insertPublicComment.mock.calls[0]?.[0] as CommentRecord;
		expect(captured.email).toBeUndefined();
	});
});

describe("comment repository factory — getApprovedCommentsForRoute", () => {
	it("filters by route AND status === approved (joint predicate)", () => {
		const { repository } = makeRepo({
			getComments: vi.fn(() => [
				comment({ id: "c1", route: "/a", status: "approved" }),
				comment({ id: "c2", route: "/a", status: "pending" }),
				comment({ id: "c3", route: "/b", status: "approved" }),
				comment({ id: "c4", route: "/a", status: "rejected" }),
			]),
		});
		const result = repository.getApprovedCommentsForRoute("/a");
		expect(result.map((c) => c.id)).toEqual(["c1"]);
	});

	it("returns an empty array when no comment matches both route and approved status", () => {
		const { repository } = makeRepo({
			getComments: vi.fn(() => [comment({ status: "pending" })]),
		});
		expect(repository.getApprovedCommentsForRoute("/blog/post")).toEqual([]);
	});
});

describe("comment repository factory — getComments passthrough", () => {
	it("forwards getComments result and call count", () => {
		const expected = [comment()];
		const getComments = vi.fn(() => expected);
		const { repository } = makeRepo({ getComments });
		expect(repository.getComments()).toBe(expected);
		expect(getComments).toHaveBeenCalledTimes(1);
	});
});

describe("hashCommentEmail", () => {
	it("normalises email by trimming and lowercasing before hashing", async () => {
		const a = await hashCommentEmail("Foo@Bar.com", "salt");
		const b = await hashCommentEmail("  foo@bar.com  ", "salt");
		expect(a).toBe(b);
	});

	it("produces different digests for different salts", async () => {
		const a = await hashCommentEmail("foo@bar.com", "salt-a");
		const b = await hashCommentEmail("foo@bar.com", "salt-b");
		expect(a).not.toBe(b);
	});

	it("normalises to lowercase (not uppercase) — equals the KMAC of the lowercase form under the comment-email key", async () => {
		// An uppercase input must hash to the digest of the lowercase form.
		// This pins the case direction so a toUpperCase mutation diverges.
		const expected = await createKmacDigest("foo@bar.com", "salt", "comment-email");
		expect(await hashCommentEmail("FOO@BAR.COM", "salt")).toBe(expected);
	});
});
