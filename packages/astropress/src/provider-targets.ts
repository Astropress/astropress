import type { ProviderCapabilities, ProviderKind } from "./platform-contracts";
import { firstPartyProviderTargets } from "./provider-targets-data";

export type FirstPartyProviderTarget = {
	id: ProviderKind;
	label: string;
	runtime: "static" | "edge" | "managed-db" | "app-platform";
	canonicalDeploySurface: string;
	adminSurface: "astropress" | "provider-managed";
	capabilities: ProviderCapabilities;
};

export function listFirstPartyProviderTargets(): FirstPartyProviderTarget[] {
	return Object.values(firstPartyProviderTargets);
}

export function getFirstPartyProviderTarget(provider: ProviderKind): FirstPartyProviderTarget {
	return firstPartyProviderTargets[provider];
}
