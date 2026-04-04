import type { Actor, CommentPolicy, CommentRecord, CommentRepository, CommentStatus } from "./persistence-types";

export interface AstropressCommentRepositoryInput {
  getComments: CommentRepository["getComments"];
  getCommentRoute(commentId: string): string | null | undefined;
  updateCommentStatus(commentId: string, nextStatus: CommentStatus): boolean;
  insertPublicComment(comment: CommentRecord): string;
  recordCommentAudit(input: {
    actor: Actor;
    action: "comment.moderate";
    summary: string;
    targetId: string;
  }): void;
}

export function createAstropressCommentRepository(
  input: AstropressCommentRepositoryInput,
): CommentRepository {
  return {
    getComments: (...args) => input.getComments(...args),
    moderateComment(commentId, nextStatus, actor) {
      const route = input.getCommentRoute(commentId);
      if (!route) {
        return { ok: false as const, error: "The selected comment record could not be found." };
      }

      input.updateCommentStatus(commentId, nextStatus);
      input.recordCommentAudit({
        actor,
        action: "comment.moderate",
        summary: `Marked ${route} as ${nextStatus}.`,
        targetId: commentId,
      });

      return { ok: true as const };
    },
    submitPublicComment(rawInput) {
      const comment: CommentRecord = {
        id: `public-${crypto.randomUUID()}`,
        author: rawInput.author,
        email: rawInput.email,
        body: rawInput.body,
        route: rawInput.route,
        status: "pending",
        policy: "open-moderated" satisfies CommentPolicy,
        submittedAt: rawInput.submittedAt,
      };

      const submittedAt = input.insertPublicComment(comment);
      return { ok: true as const, comment: { ...comment, submittedAt } };
    },
    getApprovedCommentsForRoute(route) {
      return input.getComments().filter((comment) => comment.route === route && comment.status === "approved");
    },
  };
}
