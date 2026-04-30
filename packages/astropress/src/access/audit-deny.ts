/**
 * Audit logging for access-control denies.
 *
 * Every `engine.can()` deny that flows through `requiresAccess` (page guard)
 * or `withAdminFormAction` (form action handler) writes a row to
 * `audit_events` so admins can review access denials post-mortem. The
 * resource_id is the requested action id; the summary is the engine's
 * matched-policy reason string.
 */

import { withLocalStoreFallback } from "../admin-store-dispatch";
import { recordD1Audit } from "../d1-audit";
import type { EvaluationResult } from "./types";

export interface LogAccessDenyInput {
	subjectEmail: string;
	action: string;
	decision: EvaluationResult;
}

/**
 * Records an `access:deny` audit row. Best-effort: failures are swallowed so
 * the deny path itself never throws.
 */
export async function logAccessDeny(
	locals: App.Locals | null | undefined,
	input: LogAccessDenyInput,
): Promise<void> {
	const summary = input.decision.reason || "Access denied";
	try {
		await withLocalStoreFallback<void>(
			locals,
			async () =>
				recordD1Audit(
					locals,
					{
						email: input.subjectEmail,
						role: "editor",
						name: input.subjectEmail,
					},
					"access:deny",
					"access",
					input.action,
					summary,
				),
			async (store) => {
				await store.recordAuditEvent({
					userEmail: input.subjectEmail,
					action: "access:deny",
					resourceType: "access",
					resourceId: input.action,
					summary,
				});
			},
		);
	} catch {
		// Audit logging is best-effort — never block a deny on a logging failure.
	}
}
