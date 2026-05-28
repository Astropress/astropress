/**
 * Runtime-action wrappers for the per-domain integration registry.
 *

 * Each function takes Astro `App.Locals`, dispatches via
 * `withLocalStoreFallback()` to obtain the host's
 * `IntegrationsRepository`, and routes through the registry's
 * `connectIntegration` / `reverifyIntegration` helpers from
 * `integrations/connect-flow.ts`. This keeps the Astro action
 * endpoints (`pages/ap-admin/actions/integration-*.ts`) thin —
 * they own ABAC, CSRF, and the redirect, but no envelope or
 * Zod-schema awareness.
 *
 * If the local admin store does not expose `integrations` (e.g. an
 * older host that hasn't applied the connected_integrations
 * migration), the helpers return a typed
 * `INTEGRATIONS_NOT_AVAILABLE` error instead of throwing — the
 * admin UI flashes the localised hint and the operator can run
 * the migration before retrying.
 */

import { withLocalStoreFallback } from "./admin-store-dispatch.js";
import {
	type ConnectIntegrationResult,
	connectIntegration,
	reverifyIntegration,
} from "./integrations/connect-flow.js";
import { getProvider, type IntegrationDomain } from "./integrations/registry.js";
import { getAstropressRootSecret } from "./runtime-env.js";
import { createD1IntegrationsRepository } from "./sqlite-runtime/integrations-d1.js";

export type RuntimeIntegrationActionResult =
	| ConnectIntegrationResult
	| {
			readonly ok: false;
			readonly status: "error";
			readonly code: "INTEGRATIONS_NOT_AVAILABLE";
	  }
	| {
			readonly ok: false;
			readonly status: "error";
			readonly code: "INTEGRATION_PROVIDER_NOT_FOUND";
	  }
	| {
			readonly ok: false;
			readonly status: "error";
			readonly code: "ROOT_SECRET_UNCONFIGURED";
	  };

export interface ConnectIntegrationActionInput<
	TFields extends Record<string, string> = Record<string, string>,
> {
	readonly domain: IntegrationDomain;
	readonly providerId: string;
	readonly fields: TFields;
	readonly configJson?: string;
}

export async function connectIntegrationAction<TFields extends Record<string, string>>(
	locals: App.Locals | null | undefined,
	input: ConnectIntegrationActionInput<TFields>,
): Promise<RuntimeIntegrationActionResult> {
	const provider = getProvider<TFields>(input.domain, input.providerId);
	if (!provider) {
		return {
			ok: false,
			status: "error",
			code: "INTEGRATION_PROVIDER_NOT_FOUND",
		};
	}
	// #126: fail closed when no real root secret is configured. getAstropressRootSecret
	// throws in production rather than sealing provider credentials under the public
	// dev fallback; surface it as an explicit typed error before any persistence.
	let rootSecret: string;
	try {
		rootSecret = getAstropressRootSecret(locals);
	} catch {
		return {
			ok: false,
			status: "error",
			code: "ROOT_SECRET_UNCONFIGURED",
		};
	}
	const now = new Date().toISOString();
	return withLocalStoreFallback<RuntimeIntegrationActionResult>(
		locals,
		async (db) => {
			const repo = createD1IntegrationsRepository({ getDb: () => db, now });
			return connectIntegration(repo, {
				provider,
				fields: input.fields,
				configJson: input.configJson,
				now,
				rootSecret,
			});
		},
		async (store) => {
			const repo = store.integrations;
			if (!repo) {
				return {
					ok: false,
					status: "error",
					code: "INTEGRATIONS_NOT_AVAILABLE",
				};
			}
			return connectIntegration(repo, {
				provider,
				fields: input.fields,
				configJson: input.configJson,
				now,
				rootSecret,
			});
		},
	);
}

export async function reverifyIntegrationAction<TFields extends Record<string, string>>(
	locals: App.Locals | null | undefined,
	domain: IntegrationDomain,
	providerId: string,
	fields: TFields,
): Promise<RuntimeIntegrationActionResult> {
	const provider = getProvider<TFields>(domain, providerId);
	if (!provider) {
		return {
			ok: false,
			status: "error",
			code: "INTEGRATION_PROVIDER_NOT_FOUND",
		};
	}
	const now = new Date().toISOString();
	return withLocalStoreFallback<RuntimeIntegrationActionResult>(
		locals,
		async (db) => {
			const repo = createD1IntegrationsRepository({ getDb: () => db, now });
			return reverifyIntegration(repo, provider, fields, now);
		},
		async (store) => {
			const repo = store.integrations;
			if (!repo) {
				return {
					ok: false,
					status: "error",
					code: "INTEGRATIONS_NOT_AVAILABLE",
				};
			}
			return reverifyIntegration(repo, provider, fields, now);
		},
	);
}

export async function setActiveIntegrationProviderAction(
	locals: App.Locals | null | undefined,
	domain: IntegrationDomain,
	providerId: string,
): Promise<
	{ ok: true } | { ok: false; code: "INTEGRATIONS_NOT_AVAILABLE" | "INTEGRATION_NOT_CONNECTED" }
> {
	const now = new Date().toISOString();
	return withLocalStoreFallback<
		{ ok: true } | { ok: false; code: "INTEGRATIONS_NOT_AVAILABLE" | "INTEGRATION_NOT_CONNECTED" }
	>(
		locals,
		async (db) => {
			const repo = createD1IntegrationsRepository({ getDb: () => db, now });
			const ok = await repo.setActiveProvider(domain, providerId);
			return ok ? { ok: true } : { ok: false, code: "INTEGRATION_NOT_CONNECTED" };
		},
		async (store) => {
			const repo = store.integrations;
			if (!repo) return { ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" };
			const ok = repo.setActiveProvider(domain, providerId);
			return ok ? { ok: true } : { ok: false, code: "INTEGRATION_NOT_CONNECTED" };
		},
	);
}

export async function disconnectIntegrationAction(
	locals: App.Locals | null | undefined,
	domain: IntegrationDomain,
	providerId: string,
): Promise<{ ok: true } | { ok: false; code: "INTEGRATIONS_NOT_AVAILABLE" }> {
	const now = new Date().toISOString();
	return withLocalStoreFallback<{ ok: true } | { ok: false; code: "INTEGRATIONS_NOT_AVAILABLE" }>(
		locals,
		async (db) => {
			const repo = createD1IntegrationsRepository({ getDb: () => db, now });
			await repo.disconnect(domain, providerId);
			return { ok: true };
		},
		async (store) => {
			const repo = store.integrations;
			if (!repo) return { ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" };
			repo.disconnect(domain, providerId);
			return { ok: true };
		},
	);
}
