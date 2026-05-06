/**
 * Behavioural accessors over the `INTEGRATIONS` manifest.
 *
 * The manifest itself lives in `integration-manifest-data.ts`; see that file
 * for the partitioning rationale (real / env-gated / coming-soon).
 */

import {
	INTEGRATIONS,
	type IntegrationEntry,
	type IntegrationStatus,
} from "./integration-manifest-data";

export {
	INTEGRATIONS,
	type IntegrationEntry,
	type IntegrationStatus,
} from "./integration-manifest-data";

export function integrationsByStatus(status: IntegrationStatus): readonly IntegrationEntry[] {
	return INTEGRATIONS.filter((entry) => entry.status === status);
}

export function findIntegrationByHref(href: string): IntegrationEntry | undefined {
	return INTEGRATIONS.find((entry) => entry.href === href);
}
