/**
 * Runtime read path for connected integrations. Adapter code that
 * needs the live API key/secret for a connected provider calls
 * {@link getConnectedProvider} once per request and is handed back
 * the typed-validated decoded fields.
 *
 * The status surface (sidebar badges, dashboards) never goes through
 * this module — those callers use {@link IntegrationsRepository.listStatuses}
 * which never touches ciphertext.
 */

import type { RootSecretCandidates } from "../integration-secret-envelope.js";
import type { IntegrationsRepository } from "../sqlite-runtime/integrations.js";

import { getProvider, type IntegrationDomain, listProviders } from "./registry.js";

export interface ConnectedProvider<
	TFields extends Record<string, string> = Record<string, string>,
> {
	readonly domain: IntegrationDomain;
	readonly providerId: string;
	readonly fields: TFields;
}

export interface GetConnectedProviderArgs {
	readonly domain: IntegrationDomain;
	readonly repo: IntegrationsRepository;
	readonly rootSecrets: RootSecretCandidates;
}

/**
 * Find the active connected provider for a domain and return its
 * decoded secret fields. Returns `undefined` when:
 *   - no connected row exists for the domain;
 *   - several providers are connected but none is marked active — the
 *     selection is ambiguous, so we refuse to guess (#127). The admin must
 *     pick one via `setActiveProvider` before the runtime read resolves;
 *   - the resolved row points at a provider id that is not registered.
 *
 * Resolution: prefer the explicitly active connected row; if exactly one
 * provider is connected, treat it as active (the common single-provider case
 * needs no manual selection). The previous behaviour silently picked the first
 * connected provider in list order, which is the bug #127 reports.
 *
 * Throws on decryption failure (KEK/DEK mismatch is operationally
 * fatal — we never want to silently degrade to the unconnected path).
 */
export async function getConnectedProvider<
	TFields extends Record<string, string> = Record<string, string>,
>(args: GetConnectedProviderArgs): Promise<ConnectedProvider<TFields> | undefined> {
	const statuses = args.repo.listStatuses();
	const connected = statuses.filter((s) => s.domain === args.domain && s.status === "connected");
	if (connected.length === 0) return undefined;
	const active =
		connected.find((s) => s.isActive) ?? (connected.length === 1 ? connected[0] : undefined);
	if (!active) return undefined;
	const provider = getProvider<TFields>(args.domain, active.provider);
	if (!provider) return undefined;
	const fields = await args.repo.findSecret<TFields>(
		args.domain,
		active.provider,
		args.rootSecrets,
	);
	const shape = provider.runtimeShape ?? provider.fields;
	const parsed = shape.safeParse(fields);
	if (!parsed.success) return undefined;
	return {
		domain: args.domain,
		providerId: active.provider,
		fields: parsed.data,
	};
}

/**
 * Per-request memoiser. Adapter call sites typically need the
 * decoded fields more than once per request (verify, send, log
 * sanitisation). Wrap a {@link getConnectedProvider} call in a
 * weak per-request cache to avoid re-decrypting on every read.
 */
export function createRequestProviderCache(
	args: GetConnectedProviderArgs,
): () => Promise<ConnectedProvider | undefined> {
	let cached: Promise<ConnectedProvider | undefined> | null = null;
	return () => {
		if (!cached) {
			cached = getConnectedProvider(args);
		}
		return cached;
	};
}

export function listRegisteredProvidersForDomain(
	domain: IntegrationDomain,
): ReadonlyArray<{ id: string; label: string }> {
	return listProviders(domain).map((p) => ({ id: p.id, label: p.label }));
}
