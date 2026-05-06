/**
 * In-memory registry of inbound-webhook providers. Pairs with
 * `webhooks/inbound.ts` (the signature primitive) and the
 * `pages/api/webhooks/[provider].ts` Astro route layer.
 *
 * Each registered provider declares the static facts the route layer
 * needs to verify and dispatch a webhook:
 *
 *   - `signatureHeader`: which inbound header carries the HMAC
 *     (e.g. `X-Hub-Signature-256` for GitHub);
 *   - `algorithm`: which `InboundWebhookAlgorithm` to verify under;
 *   - `eventHeader` (optional): which header carries the event name,
 *     used by the route layer to dispatch into per-event handlers
 *     after signature verification succeeds.
 *
 * The secret used to verify HMACs is NOT held in the registry — it
 * comes from the connected-integration row for the same
 * `(domain, providerId)` pair, sealed via the Phase 2 envelope. The
 * registry is therefore safe to enumerate from the admin UI.
 */

import type { InboundWebhookAlgorithm } from "./inbound.js";

export interface InboundWebhookProviderDefinition {
	readonly id: string;
	readonly label: string;
	readonly signatureHeader: string;
	readonly algorithm: InboundWebhookAlgorithm;
	readonly eventHeader?: string;
}

export class InboundWebhookRegistryError extends Error {
	constructor(
		public readonly code: "DUPLICATE_PROVIDER",
		message: string,
	) {
		super(message);
		this.name = "InboundWebhookRegistryError";
	}
}

const registry = new Map<string, InboundWebhookProviderDefinition>();

export function registerInboundWebhookProvider(
	def: InboundWebhookProviderDefinition,
): InboundWebhookProviderDefinition {
	if (registry.has(def.id)) {
		throw new InboundWebhookRegistryError(
			"DUPLICATE_PROVIDER",
			`inbound webhook provider ${def.id} already registered`,
		);
	}
	registry.set(def.id, def);
	return def;
}

export function getInboundWebhookProvider(
	providerId: string,
): InboundWebhookProviderDefinition | undefined {
	return registry.get(providerId);
}

export function listInboundWebhookProviders(): readonly InboundWebhookProviderDefinition[] {
	return Array.from(registry.values());
}

export function _resetInboundWebhookRegistryForTests(): void {
	registry.clear();
}
