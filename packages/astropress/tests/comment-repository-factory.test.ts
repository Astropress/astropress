import { describe, expect, it, vi } from "vitest";
import { createAstropressCommentRepository } from "../src/comment-repository-factory";

describe("comment repository factory", () => {
  it("moderates and submits comments through package-owned repository assembly", async () => {
    const recordCommentAudit = vi.fn();
    const repository = createAstropressCommentRepository({
      getComments: vi.fn(() => [
        {
          id: "c1",
          author: "Alice",
          body: "Hello",
          route: "/blog/post",
          status: "approved",
          policy: "open-moderated",
          submittedAt: "2025-01-01T00:00:00.000Z",
        },
      ]),
      getCommentRoute: vi.fn(() => "/blog/post"),
      updateCommentStatus: vi.fn(() => true),
      insertPublicComment: vi.fn(() => "2025-01-02T00:00:00.000Z"),
      recordCommentAudit,
    });

    expect(
      repository.moderateComment("c1", "rejected", {
        email: "admin@example.com",
        role: "admin",
        name: "Admin",
      }),
    ).toEqual({ ok: true });

    const submitted = await repository.submitPublicComment({
      author: "Bob",
      email: "bob@example.com",
      body: "Nice post",
      route: "/blog/post",
      submittedAt: "2025-01-02T00:00:00.000Z",
    });

    expect(submitted.ok).toBe(true);
    if (submitted.ok === true) {
      expect(submitted.comment.status).toBe("pending");
      expect(submitted.comment.submittedAt).toBe("2025-01-02T00:00:00.000Z");
    }

    expect(repository.getApprovedCommentsForRoute("/blog/post")).toHaveLength(1);
    expect(recordCommentAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "comment.moderate",
        targetId: "c1",
      }),
    );
  });
});
