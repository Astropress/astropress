/**
 * Plausible analytics provider — connect-form + verify.
 *
 * Plausible's API token (https://plausible.io/docs/stats-api) is
 * scoped to a single account. The verify step calls
 * `${host}/api/v1/sites/${siteId}` with the bearer token. A 200
 * means "valid token AND token has access to siteId" — both
 * conditions matter. A 401 means the token is wrong; a 403 means
 * the token is real but lacks access to that site (typed
 * `INTEGRATION_AUTH_REJECTED` so the UX can suggest checking the
 * site selection).
 */

import { z } from "zod";

import { registerAnalytics } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const PLAUSIBLE_PROVIDER_ID = "plausible";

const DEFAULT_HOST = "https://plausible.io";

export const plausibleFieldsSchema = z.object({
	apiKey: z.string().min(1),
	siteId: z.string().min(1),
	host: z
		.string()
		.url()
		.optional()
		.transform((v) => v ?? DEFAULT_HOST),
});

export type PlausibleFields = z.infer<typeof plausibleFieldsSchema>;

export interface PlausibleVerifyDeps {
	readonly fetchImpl?: typeof fetch;
}

export async function verifyPlausibleConnection(
	fields: PlausibleFields,
	signal: AbortSignal,
	deps: PlausibleVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const url = new URL(
		`/api/v1/sites/${encodeURIComponent(fields.siteId)}`,
		fields.host,
	);
	const res = await fetchImpl(url, {
		method: "GET",
		signal,
		headers: { Authorization: `Bearer ${fields.apiKey}` },
	});
	if (res.ok) return;
	const err = new Error(`plausible verify failed: ${res.status}`);
	(err as Error & { code?: string }).code =
		res.status === 401 || res.status === 403
			? "INTEGRATION_AUTH_REJECTED"
			: "INTEGRATION_VERIFY_FAILED";
	throw err;
}

let registered: RegisteredProvider<PlausibleFields> | null = null;

export function registerPlausibleProvider(
	deps: PlausibleVerifyDeps = {},
): RegisteredProvider<PlausibleFields> {
	if (registered) return registered;
	registered = registerAnalytics<PlausibleFields>({
		id: PLAUSIBLE_PROVIDER_ID,
		label: "Plausible",
		fields: plausibleFieldsSchema,
		verify: (fields, { signal }) =>
			verifyPlausibleConnection(fields, signal, deps),
		defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
	});
	return registered;
}

export function _resetPlausibleProviderForTests(): void {
	registered = null;
}
