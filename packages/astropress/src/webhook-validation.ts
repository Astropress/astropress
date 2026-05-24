import type { WebhookEvent } from "./platform-contracts";
import { WEBHOOK_EVENTS } from "./webhook-validation-data";

/**
 * Shared validation for webhook creation. Both the admin form action
 * (`pages/ap-admin/actions/webhook-create.ts`) and the token-authenticated
 * REST API (`pages/ap-api/v1/webhooks.ts`) run callers' input through this
 * one layer, so a `webhooks:manage` token can never persist a webhook the
 * admin UI would reject (issue #141). The stored URL is later handed to
 * `fetch()` by the dispatcher, so the scheme check here is the gate that
 * keeps arbitrary callback targets out of the store.
 */

export interface WebhookCreateInput {
	url: string;
	events: WebhookEvent[];
}

export type WebhookValidationResult =
	| { ok: true; value: WebhookCreateInput }
	| { ok: false; error: string };

/** Narrowing guard for a single event name against the canonical allowlist. */
export function isWebhookEvent(value: unknown): value is WebhookEvent {
	return typeof value === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

/** Human-readable allowlist for error messages — derived, never hand-typed. */
function supportedEventsList(): string {
	return WEBHOOK_EVENTS.join(", ");
}

/**
 * Validate raw, untrusted webhook-creation input. Returns the normalised
 * `{ url, events }` on success or a single user-facing error string.
 *
 * Invalid/unsupported event names are *rejected*, not silently dropped: a
 * caller asking for an event we do not support is a mistake worth surfacing,
 * and silently persisting a partial subset hides it. The error never echoes
 * the caller's rejected strings back — it lists the supported events instead,
 * so nothing user-controlled is reflected into the admin page or API body.
 */
export function validateWebhookCreateInput(input: {
	url: unknown;
	events: unknown;
}): WebhookValidationResult {
	const url = typeof input.url === "string" ? input.url.trim() : "";
	if (!url) return { ok: false, error: "Webhook URL is required." };
	if (!url.startsWith("https://") && !url.startsWith("http://"))
		return { ok: false, error: "URL must start with http:// or https://" };

	const rawEvents = Array.isArray(input.events) ? input.events : [];
	if (rawEvents.length === 0) return { ok: false, error: "At least one event is required." };

	if (!rawEvents.every(isWebhookEvent))
		return {
			ok: false,
			error: `One or more events are not supported. Valid events: ${supportedEventsList()}.`,
		};

	return { ok: true, value: { url, events: rawEvents as WebhookEvent[] } };
}
