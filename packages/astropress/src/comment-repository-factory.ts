import { createKmacDigest } from "./crypto-primitives";
import type {
	Actor,
	CommentPolicy,
	CommentRecord,
	CommentRepository,
	CommentStatus,
} from "./persistence-types";

/**
 * Hash a comment author's email address with a site-specific salt (GDPR Article 25 —
 * data protection by design). The resulting hex digest is used in place of the raw
 * email so the stored value cannot be reversed without knowledge of the salt.
 *
 * @param email     The raw email address (never stored after this call).
 * @param siteSalt  Site-specific secret (e.g. `getCmsConfig().sessionSecret`).
 */
export async function hashCommentEmail(
	email: string,
	siteSalt: string,
): Promise<string> {
	return createKmacDigest(
		email.trim().toLowerCase(),
		siteSalt,
		"comment-email",
	);
}

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
	/**
	 * Site-specific salt used to hash comment author emails before storage.
	 * When provided, `submitPublicComment` replaces the raw email with a
	 * KMAC256 hex digest so no recoverable email address is persisted.
	 *
	 * Pass `getCmsConfig().sessionSecret` here in production.
	 */
	sessionSalt?: string;
}

export function createAstropressCommentRepository(
	input: AstropressCommentRepositoryInput,
): CommentRepository {
	return {
		getComments: (...args) => input.getComments(...args),
		moderateComment(commentId, nextStatus, actor) {
			const route = input.getCommentRoute(commentId);
			if (!route) {
				return {
					ok: false as const,
					error: "The selected comment record could not be found.",
				};
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
		async submitPublicComment(rawInput) {
			// Hash the author email before storage when a site salt is provided.
			// This ensures no recoverable PII is persisted (GDPR Art. 25).
			const hashedEmail =
				rawInput.email && input.sessionSalt
					? await hashCommentEmail(rawInput.email, input.sessionSalt)
					: rawInput.email;

			const comment: CommentRecord = {
				id: `public-${crypto.randomUUID()}`,
				author: rawInput.author,
				email: hashedEmail,
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
			return input
				.getComments()
				.filter(
					(comment) => comment.route === route && comment.status === "approved",
				);
		},
	};
}
