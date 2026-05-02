/**
 * Listmonk newsletter provider — push-button registration for the
 * newsletter domain.
 *
 * verify() runs a HEAD against `${baseUrl}/api/health` with HTTP basic
 * authentication built from the connection's apiUser/apiKey. The
 * response status drives a typed error code so the admin UI can
 * localise the connect failure without leaking upstream payloads.
 *
 *   200          → connected
 *   401 / 403    → INTEGRATION_AUTH_REJECTED
 *   404          → INTEGRATION_NOT_FOUND
 *   429          → INTEGRATION_RATE_LIMITED
 *   any other 4xx/5xx → INTEGRATION_VERIFY_FAILED
 *
 * Network/abort failures bubble through the connect-flow sanitiser
 * (TypeError → NETWORK_ERROR, AbortError → TIMEOUT) and never reach
 * the database with raw upstream payload bytes.
 */

import { z } from "zod";

import type { IntegrationErrorCode } from "../../integration-error-sanitizer.js";
import { registerNewsletter } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const LISTMONK_FIELDS = z.object({
	baseUrl: z.string().url(),
	apiUser: z.string().min(1),
	apiKey: z.string().min(1),
});

export type ListmonkFields = z.infer<typeof LISTMONK_FIELDS>;

const HEALTH_PATH = "/api/health";

export class ListmonkVerifyError extends Error {
	constructor(public readonly code: IntegrationErrorCode) {
		super(code);
		this.name = "ListmonkVerifyError";
	}
}

export interface ListmonkVerifyDeps {
	readonly fetch?: typeof fetch;
}

export function buildListmonkHealthUrl(baseUrl: string): string {
	return new URL(HEALTH_PATH, baseUrl).toString();
}

export function buildListmonkAuthHeader(
	apiUser: string,
	apiKey: string,
): string {
	return `Basic ${btoa(`${apiUser}:${apiKey}`)}`;
}

export async function verifyListmonk(
	fields: ListmonkFields,
	ctx: { signal: AbortSignal },
	deps: ListmonkVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetch ?? fetch;
	const url = buildListmonkHealthUrl(fields.baseUrl);
	const auth = buildListmonkAuthHeader(fields.apiUser, fields.apiKey);
	const res = await fetchImpl(url, {
		method: "HEAD",
		headers: { Authorization: auth },
		signal: ctx.signal,
	});
	if (res.status === 401 || res.status === 403) {
		throw new ListmonkVerifyError("INTEGRATION_AUTH_REJECTED");
	}
	if (res.status === 404) {
		throw new ListmonkVerifyError("INTEGRATION_NOT_FOUND");
	}
	if (res.status === 429) {
		throw new ListmonkVerifyError("INTEGRATION_RATE_LIMITED");
	}
	if (!res.ok) {
		throw new ListmonkVerifyError("INTEGRATION_VERIFY_FAILED");
	}
}

export function registerListmonk(): RegisteredProvider<ListmonkFields> {
	return registerNewsletter<ListmonkFields>({
		id: "listmonk",
		label: "Listmonk",
		fields: LISTMONK_FIELDS,
		verify: verifyListmonk,
		defaultErrorCode: "INTEGRATION_VERIFY_FAILED",
	});
}
