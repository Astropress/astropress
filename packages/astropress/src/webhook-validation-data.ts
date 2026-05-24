// stryker-disable-file: data-only — canonical webhook-event allowlist. The
// values carry no behavioural contract of their own; the validator that
// consumes them (webhook-validation.ts) is mutation-tested at ≥95%. Splitting
// the constant out keeps a static-mutant on this array from surviving under
// the vitest worker-cache (see CLAUDE.md "module-level constants").
import type { WebhookEvent } from "./platform-contracts";

/**
 * The single source of truth for which webhook events callers may register.
 * Both the admin form action and the REST API validate against this list, so
 * the two creation paths can never drift apart on what counts as a valid event.
 */
export const WEBHOOK_EVENTS: readonly WebhookEvent[] = [
	"content.published",
	"content.updated",
	"content.deleted",
	"media.uploaded",
	"media.deleted",
];
