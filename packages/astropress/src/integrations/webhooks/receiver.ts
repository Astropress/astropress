/**
 * Pure helper that turns a raw inbound webhook request (body bytes +
 * header lookup + provider id) into a typed result the Astro route
 * layer can consume:
 *
 *   - `RECEIVER_UNKNOWN_PROVIDER` — no provider registered under the
 *     URL slug. Route returns 404.
 *   - `RECEIVER_MISSING_SIGNATURE` — provider exists but the inbound
 *     headers carry no signature header. Route returns 401.
 *   - `RECEIVER_INVALID_SIGNATURE` — signature didn't verify under
 *     the secret. Route returns 401.
 *   - `RECEIVER_OK` — signature verified. The result carries the
 *     decoded event name (or `null` if the provider has no
 *     `eventHeader`) so the route can dispatch to a handler.
 *
 * Splitting this from the Astro route keeps the verifier pure — the
 * route just owns body-stream reading, secret loading, and HTTP
 * response construction.
 */

import { verifyInboundWebhookSignature } from "./inbound.js";
import { getInboundWebhookProvider, type InboundWebhookProviderDefinition } from "./registry.js";

export interface InboundWebhookReceiveArgs {
	readonly providerId: string;
	readonly bodyBytes: Uint8Array;
	readonly secret: string;
	readonly headers: (name: string) => string | null;
}

export type InboundWebhookReceiveResult =
	| {
			readonly ok: true;
			readonly provider: InboundWebhookProviderDefinition;
			readonly eventName: string | null;
	  }
	| {
			readonly ok: false;
			readonly code:
				| "RECEIVER_UNKNOWN_PROVIDER"
				| "RECEIVER_MISSING_SIGNATURE"
				| "RECEIVER_INVALID_SIGNATURE";
	  };

export async function receiveInboundWebhook(
	args: InboundWebhookReceiveArgs,
): Promise<InboundWebhookReceiveResult> {
	const provider = getInboundWebhookProvider(args.providerId);
	if (!provider) {
		return { ok: false, code: "RECEIVER_UNKNOWN_PROVIDER" };
	}
	const signature = args.headers(provider.signatureHeader);
	if (signature === null || signature.length === 0) {
		return { ok: false, code: "RECEIVER_MISSING_SIGNATURE" };
	}
	const ok = await verifyInboundWebhookSignature({
		algo: provider.algorithm,
		header: signature,
		body: args.bodyBytes,
		secret: args.secret,
	});
	if (!ok) {
		return { ok: false, code: "RECEIVER_INVALID_SIGNATURE" };
	}
	const eventName = provider.eventHeader ? args.headers(provider.eventHeader) : null;
	return { ok: true, provider, eventName };
}
