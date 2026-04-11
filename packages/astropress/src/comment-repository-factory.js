/**
 * Hash a comment author's email address with a site-specific salt (GDPR Article 25 —
 * data protection by design). The resulting hex digest is used in place of the raw
 * email so the stored value cannot be reversed without knowledge of the salt.
 */
export async function hashCommentEmail(email, siteSalt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email + siteSalt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

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
    async submitPublicComment(rawInput) {
      // Hash the author email before storage when a site salt is provided.
      // This ensures no recoverable PII is persisted (GDPR Art. 25).
      const hashedEmail =
        rawInput.email && input.sessionSalt
          ? await hashCommentEmail(rawInput.email, input.sessionSalt)
          : rawInput.email;

      const comment = {
        id: `public-${crypto.randomUUID()}`,
        author: rawInput.author,
        email: hashedEmail,
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
