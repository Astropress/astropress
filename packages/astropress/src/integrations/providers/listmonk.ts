/**
 * Listmonk newsletter provider — push-button connect, runtime read.
 *
 * Phase 4 turns Listmonk into a real, push-button integration:
 *
 *   1. The admin opens the newsletter page and submits a connect
 *      form (baseUrl, apiUser, apiKey).
 *   2. The connect flow runs `verify()` — a HEAD against
 *      `${baseUrl}/api/health` with HTTP basic auth — to make sure
 *      the credentials are real before sealing them.
 *   3. The send/import paths look up the active provider via
 *      `getConnectedProvider({ domain: "newsletter" })` and use the
 *      decrypted basic-auth header.
 *
 * Self-hosted Listmonk instances tend to expose `/api/health`
 * publicly even when the API root is password-protected, so a HEAD
 * (rather than GET) keeps the verify cheap and avoids leaking the
 * health-check body into our error sanitiser.
 */

import { z } from "zod";

import { registerNewsletter } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const LISTMONK_PROVIDER_ID = "listmonk";

export const listmonkFieldsSchema = z.object({
	baseUrl: z.string().url(),
	apiUser: z.string().min(1),
	apiKey: z.string().min(1),
});

export type ListmonkFields = z.infer<typeof listmonkFieldsSchema>;

export function buildListmonkAuthHeader(
	fields: Pick<ListmonkFields, "apiUser" | "apiKey">,
): string {
	return `Basic ${btoa(`${fields.apiUser}:${fields.apiKey}`)}`;
}

export interface ListmonkVerifyDeps {
	readonly fetchImpl?: typeof fetch;
}

export async function verifyListmonkConnection(
	fields: ListmonkFields,
	signal: AbortSignal,
	deps: ListmonkVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const url = new URL("/api/health", fields.baseUrl);
	const res = await fetchImpl(url, {
		method: "HEAD",
		signal,
		headers: {
			Authorization: buildListmonkAuthHeader(fields),
		},
	});
	if (!res.ok) {
		const err = new Error(`listmonk verify failed: ${res.status}`);
		// Surface 401/403 as auth-rejected so the UX is precise.
		(err as Error & { code?: string }).code =
			res.status === 401 || res.status === 403
				? "INTEGRATION_AUTH_REJECTED"
				: "INTEGRATION_VERIFY_FAILED";
		throw err;
	}
}

let registered: RegisteredProvider<ListmonkFields> | null = null;

export function registerListmonkProvider(
	deps: ListmonkVerifyDeps = {},
): RegisteredProvider<ListmonkFields> {
	if (registered) return registered;
	registered = registerNewsletter<ListmonkFields>({
		id: LISTMONK_PROVIDER_ID,
		label: "Listmonk",
		fields: listmonkFieldsSchema,
		verify: (fields, { signal }) =>
			verifyListmonkConnection(fields, signal, deps),
		defaultErrorCode: "INTEGRATION_VERIFY_FAILED",
	});
	return registered;
}

/**
 * Test-only helper: clear cached registration so a unit test that
 * resets the global registry can re-register cleanly.
 */
export function _resetListmonkProviderForTests(): void {
	registered = null;
}
