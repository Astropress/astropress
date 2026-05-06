import { receiveInboundWebhook } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * Generic inbound-webhook receiver. The provider id comes from the
 * URL slug (e.g. `/api/webhooks/github`); the registered provider
 * declares which header carries the HMAC and what algorithm it uses.
 *
 * The secret is sourced from the request's `runtime.env` map under
 * the convention `WEBHOOK_SECRET_<PROVIDER_ID_UPPER>`. This keeps
 * the route fully working before the IntegrationsRepository is
 * wired into the request context — once that lands, we can resolve
 * the secret from the connected_integrations row instead, with
 * env-var as fallback.
 *
 * Successful verification returns 200 with `{event}`; failed
 * verification returns 401 (signature) or 404 (unknown provider).
 * No body parsing happens before the signature check — the verifier
 * runs over the raw bytes so a forged body cannot ride a stale
 * signature past the gate.
 */

export const POST: APIRoute = async (context) => {
	const providerSlug = context.params.provider;
	if (!providerSlug) {
		return new Response("Missing provider slug.", { status: 400 });
	}

	const env =
		(context.locals as { runtime?: { env?: Record<string, string> } } | null)?.runtime?.env ??
		(typeof process !== "undefined" ? process.env : {});
	const secretEnvKey = `WEBHOOK_SECRET_${providerSlug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
	const secret = env[secretEnvKey];
	if (!secret) {
		return new Response(`Inbound webhook secret not configured (env ${secretEnvKey}).`, {
			status: 503,
		});
	}

	const buffer = await context.request.arrayBuffer();
	const bodyBytes = new Uint8Array(buffer);

	const result = await receiveInboundWebhook({
		providerId: providerSlug,
		bodyBytes,
		secret,
		headers: (name) => context.request.headers.get(name),
	});

	if (!result.ok) {
		switch (result.code) {
			case "RECEIVER_UNKNOWN_PROVIDER":
				return new Response("Unknown webhook provider.", { status: 404 });
			case "RECEIVER_MISSING_SIGNATURE":
			case "RECEIVER_INVALID_SIGNATURE":
				return new Response("Signature rejected.", { status: 401 });
		}
	}

	// Verified. Dispatch to a registered handler in a follow-up
	// commit; for now, acknowledge with the parsed event name so
	// observability can confirm the round-trip end to end.
	return new Response(JSON.stringify({ ok: true, event: result.eventName }), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
};
