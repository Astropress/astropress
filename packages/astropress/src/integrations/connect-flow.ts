/**
 * Shared admin-action helper that wires a registered provider's
 * verify() callback to the Phase 2 secret-store repository.
 *
 * `connectIntegration` (first-time connect):
 *   1. Validate the inbound fields against the provider's Zod schema;
 *      a schema miss returns `status:"error"` with no persistence.
 *   2. Run verify() under a 10-second AbortController so a hung
 *      upstream API can never block the admin UI.
 *   3. On verify failure, return `status:"error"` with a sanitised
 *      typed code WITHOUT writing anything — a first-time connect never
 *      persists a half-connected row. There is no caller-selectable
 *      persist-vs-refuse policy; refusal is the only behaviour.
 *   4. On verify success, persist the sealed secret + status row in
 *      one repo.connect() call.
 *
 * `reverifyIntegration` (already-connected row): re-runs verify() and,
 * on failure, persists `status:"error"` + the typed code via
 * updateStatus (the row already exists, so there is no half-connected
 * risk). Success flips it back to `connected`.
 *
 * The admin actions (`integration-connect`, `-disconnect`,
 * `-reverify`, `-set-active`) compose these helpers rather than
 * duplicating the timeout/sanitise dance.
 */

import {
	type IntegrationErrorCode,
	sanitizeIntegrationError,
} from "../integration-error-sanitizer.js";
import type { IntegrationsRepository } from "../sqlite-runtime/integrations.js";
import type { D1IntegrationsRepository } from "../sqlite-runtime/integrations-d1.js";
import type { IntegrationDomain, RegisteredProvider } from "./registry.js";

/**
 * Minimal repo surface needed by `connectIntegration` —
 * structurally satisfied by both the sqlite and D1 repositories
 * because both expose an async `.connect()` with the same signature.
 * Splitting the type this narrowly lets the connect-flow stay
 * runtime-agnostic without forcing the wider sync/async split.
 */
type ConnectableIntegrationsRepo =
	| Pick<IntegrationsRepository, "connect">
	| Pick<D1IntegrationsRepository, "connect">;

/**
 * Reverify needs `updateStatus` in addition to verify. The sqlite
 * repo returns `boolean` synchronously; the D1 repo returns
 * `Promise<boolean>`. Connect-flow always awaits the call (`await
 * Promise.resolve(...)` is a no-op for raw booleans), so the union
 * is safe at the call site even though the return-type narrows
 * unevenly.
 */
type ReverifiableIntegrationsRepo =
	| Pick<IntegrationsRepository, "updateStatus">
	| Pick<D1IntegrationsRepository, "updateStatus">;

export interface ConnectIntegrationParams<
	TFields extends Record<string, string> = Record<string, string>,
> {
	readonly provider: RegisteredProvider<TFields>;
	readonly fields: TFields;
	readonly configJson?: string;
	readonly now: string;
	readonly rootSecret: string;
	readonly verifyTimeoutMs?: number;
}

export interface ConnectIntegrationOk {
	readonly ok: true;
	readonly status: "connected";
}

export interface ConnectIntegrationErr {
	readonly ok: false;
	readonly status: "error";
	readonly code: IntegrationErrorCode;
}

export type ConnectIntegrationResult = ConnectIntegrationOk | ConnectIntegrationErr;

const DEFAULT_VERIFY_TIMEOUT_MS = 10_000;

export async function runProviderVerify<TFields extends Record<string, string>>(
	provider: RegisteredProvider<TFields>,
	fields: TFields,
	timeoutMs: number = DEFAULT_VERIFY_TIMEOUT_MS,
): Promise<{ ok: true } | { ok: false; code: IntegrationErrorCode }> {
	if (!provider.verify) return { ok: true };
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		await provider.verify(fields, { signal: controller.signal });
		return { ok: true };
	} catch (err) {
		// Sanitiser maps known shapes (AbortError → TIMEOUT,
		// TypeError → NETWORK_ERROR) but defaults unknown throws to
		// UNKNOWN_ERROR. In a verify() context, an unknown failure is
		// semantically a VERIFY_FAILED — fall back to that (or to the
		// provider's defaultErrorCode override) so the UI surfaces a
		// useful localised hint rather than the generic catch-all.
		const sanitised = sanitizeIntegrationError(err);
		const code: IntegrationErrorCode =
			sanitised === "INTEGRATION_UNKNOWN_ERROR"
				? (provider.defaultErrorCode ?? "INTEGRATION_VERIFY_FAILED")
				: sanitised;
		return { ok: false, code };
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Run verify() then, on success, persist the sealed secret + status
 * row. On verify failure, persist a status row in `error` state with
 * the typed code in `last_error` so the UI can show a localised hint
 * without exposing the upstream error message.
 */
export async function connectIntegration<TFields extends Record<string, string>>(
	repo: ConnectableIntegrationsRepo,
	params: ConnectIntegrationParams<TFields>,
): Promise<ConnectIntegrationResult> {
	const parsed = params.provider.fields.safeParse(params.fields);
	if (!parsed.success) {
		return {
			ok: false,
			status: "error",
			code: "INTEGRATION_VERIFY_FAILED",
		};
	}
	const verifyResult = await runProviderVerify(
		params.provider,
		parsed.data,
		params.verifyTimeoutMs,
	);
	if (!verifyResult.ok) {
		// First-time verify failure: do not persist a half-connected
		// secret. Caller flashes the typed code; the user retries.
		// For reverify on an already-connected row, callers route
		// through reverifyIntegration() which uses updateStatus.
		return { ok: false, status: "error", code: verifyResult.code };
	}
	await repo.connect(
		{
			domain: params.provider.domain,
			provider: params.provider.id,
			configJson: params.configJson ?? "{}",
			secretFields: parsed.data,
			now: params.now,
		},
		params.rootSecret,
	);
	return { ok: true, status: "connected" };
}

/**
 * Re-run verify() for an already-connected provider. Used by the
 * `integration-reverify` admin action and by the sidebar status
 * health check.
 */
export async function reverifyIntegration<TFields extends Record<string, string>>(
	repo: ReverifiableIntegrationsRepo,
	provider: RegisteredProvider<TFields>,
	fields: TFields,
	now: string,
	timeoutMs: number = DEFAULT_VERIFY_TIMEOUT_MS,
): Promise<ConnectIntegrationResult> {
	const verifyResult = await runProviderVerify(provider, fields, timeoutMs);
	if (!verifyResult.ok) {
		// `await Promise.resolve(...)` works uniformly: sqlite returns a
		// raw boolean, D1 returns a Promise<boolean>. Without the await,
		// the D1 fire-and-forget could be GC'd before the worker
		// invocation returns.
		await Promise.resolve(
			repo.updateStatus({
				domain: provider.domain,
				provider: provider.id,
				status: "error",
				lastCheckAt: now,
				lastError: verifyResult.code,
			}),
		);
		return { ok: false, status: "error", code: verifyResult.code };
	}
	await Promise.resolve(
		repo.updateStatus({
			domain: provider.domain,
			provider: provider.id,
			status: "connected",
			lastCheckAt: now,
			lastError: null,
		}),
	);
	return { ok: true, status: "connected" };
}

export type { IntegrationDomain };
