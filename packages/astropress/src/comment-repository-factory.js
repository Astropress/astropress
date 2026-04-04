export function createAstropressCommentRepository(input) {
  return {
    getComments: (...args) => input.getComments(...args),
    moderateComment(commentId, nextStatus, actor) {
      const route = input.getCommentRoute(commentId);
      if (!route) {
        return { ok: false, error: "The selected comment record could not be found." };
      }

      input.updateCommentStatus(commentId, nextStatus);
      input.recordCommentAudit({
        actor,
        action: "comment.moderate",
        summary: `Marked ${route} as ${nextStatus}.`,
        targetId: commentId,
      });

      return { ok: true };
    },
    submitPublicComment(rawInput) {
      const comment = {
        id: `public-${crypto.randomUUID()}`,
        author: rawInput.author,
        email: rawInput.email,
        body: rawInput.body,
        route: rawInput.route,
        status: "pending",
        policy: "open-moderated",
        submittedAt: rawInput.submittedAt,
      };

      const submittedAt = input.insertPublicComment(comment);
      return { ok: true, comment: { ...comment, submittedAt } };
    },
    getApprovedCommentsForRoute(route) {
      return input.getComments().filter((comment) => comment.route === route && comment.status === "approved");
    },
  };
}
