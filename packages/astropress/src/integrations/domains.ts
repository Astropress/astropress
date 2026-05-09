// stryker-disable-file: data-only — typed thin-wrapper bindings; each export is a one-line passthrough that pins a literal domain string for `registerProvider`.
/**
 * Typed thin wrappers around {@link registerProvider} that pin the
 * domain at the call site so a typo is a TypeScript error.
 *
 * Hosts wire these from their setup module:
 *
 *   registerNewsletter({
 *     id: "listmonk",
 *     label: "Listmonk",
 *     fields: z.object({ baseUrl: z.string().url(), apiUser: z.string(),
 *                        apiKey: z.string() }),
 *     verify: async (f, { signal }) => {
 *       const res = await fetch(`${f.baseUrl}/api/health`, {
 *         signal, headers: { Authorization: basicAuth(f.apiUser, f.apiKey) },
 *       });
 *       if (!res.ok) throw new Error("verify-failed");
 *     },
 *   });
 */

import type { ProviderDefinition, RegisteredProvider } from "./registry.js";
import { registerProvider } from "./registry.js";

type Register = <TFields extends Record<string, string>>(
	def: ProviderDefinition<TFields>,
) => RegisteredProvider<TFields>;

export const registerNewsletter: Register = (def) => registerProvider("newsletter", def);

export const registerAnalytics: Register = (def) => registerProvider("analytics", def);

export const registerAbTesting: Register = (def) => registerProvider("ab-testing", def);

export const registerSearch: Register = (def) => registerProvider("search", def);

export const registerCdnPurge: Register = (def) => registerProvider("cdn-purge", def);

export const registerMonitoring: Register = (def) => registerProvider("monitoring", def);

export const registerForms: Register = (def) => registerProvider("forms", def);

export const registerDeployHooks: Register = (def) => registerProvider("deploy-hooks", def);
