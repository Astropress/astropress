/**
 * Per-domain integration registry. Phase 3 of integration-honesty.
 *
 * Each registered provider declares:
 *   - `id`         — short stable identifier (`"listmonk"`, `"plausible"`).
 *   - `label`      — human-readable display name shown in the connect UI.
 *   - `fields`     — Zod schema for the secret payload that connect()
 *                    seals via the Phase 2 envelope.
 *   - `verify`     — async callback the connect action runs against the
 *                    decoded payload before persisting. Throws to mark
 *                    the row as `error` with a typed code.
 *   - `runtimeShape` — optional Zod schema for the decoded fields the
 *                      runtime read path expects. Defaults to `fields`.
 *
 * The registry is a transient, in-memory map. Hosts call
 * `registerProvider()` from their setup module (alongside or instead
 * of `registerCms()`); admin actions and runtime adapters look
 * providers up by `(domain, providerId)`.
 *
 * Domain identifiers are deliberately a closed set so a typo at a
 * call site is a TypeScript error, not a silent miss.
 */
import type { z } from "zod";

import type { IntegrationErrorCode } from "../integration-error-sanitizer.js";
import { INTEGRATION_DOMAINS, type IntegrationDomain } from "./registry-data.js";

export { INTEGRATION_DOMAINS, type IntegrationDomain };

export interface ProviderDefinition<TFields extends Record<string, string>> {
	readonly id: string;
	readonly label: string;
	readonly fields: z.ZodType<TFields>;
	readonly verify?: (fields: TFields, ctx: { signal: AbortSignal }) => Promise<void>;
	readonly runtimeShape?: z.ZodType<TFields>;
	/**
	 * Optional override for what error code a thrown {@link verify}
	 * should map to when the thrown value carries no usable hint. The
	 * default sanitiser handles most cases, but providers like Plausible
	 * want a 403 to map to `INTEGRATION_AUTH_REJECTED` rather than
	 * `INTEGRATION_VERIFY_FAILED`.
	 */
	readonly defaultErrorCode?: IntegrationErrorCode;
}

export interface RegisteredProvider<TFields extends Record<string, string> = Record<string, string>>
	extends ProviderDefinition<TFields> {
	readonly domain: IntegrationDomain;
}

export class IntegrationRegistryError extends Error {
	constructor(
		public readonly code: "DUPLICATE_PROVIDER" | "UNKNOWN_DOMAIN",
		message: string,
	) {
		super(message);
		this.name = "IntegrationRegistryError";
	}
}

const registry = new Map<string, RegisteredProvider>();

function key(domain: IntegrationDomain, providerId: string): string {
	return `${domain}|${providerId}`;
}

export function registerProvider<TFields extends Record<string, string>>(
	domain: IntegrationDomain,
	definition: ProviderDefinition<TFields>,
): RegisteredProvider<TFields> {
	if (!INTEGRATION_DOMAINS.includes(domain)) {
		throw new IntegrationRegistryError("UNKNOWN_DOMAIN", `unknown integration domain: ${domain}`);
	}
	const k = key(domain, definition.id);
	if (registry.has(k)) {
		throw new IntegrationRegistryError(
			"DUPLICATE_PROVIDER",
			`provider ${definition.id} already registered for domain ${domain}`,
		);
	}
	const entry: RegisteredProvider<TFields> = { domain, ...definition };
	registry.set(k, entry as unknown as RegisteredProvider);
	return entry;
}

export function getProvider<TFields extends Record<string, string>>(
	domain: IntegrationDomain,
	providerId: string,
): RegisteredProvider<TFields> | undefined {
	return registry.get(key(domain, providerId)) as RegisteredProvider<TFields> | undefined;
}

export function listProviders(domain: IntegrationDomain): readonly RegisteredProvider[] {
	const out: RegisteredProvider[] = [];
	for (const [k, v] of registry) {
		if (k.startsWith(`${domain}|`)) out.push(v);
	}
	return out;
}

/**
 * Test-only helper: clear all registered providers. Production code
 * never calls this — providers register at boot and live for the
 * process lifetime.
 */
export function _resetRegistryForTests(): void {
	registry.clear();
}
