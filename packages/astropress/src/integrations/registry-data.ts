// stryker-disable-file: data-only — closed set of integration-domain identifiers; mutating any string just produces a different (or empty) literal that the rest of the registry rejects via UNKNOWN_DOMAIN. The membership check is exercised by registry.ts logic mutants, not by re-asserting these literals.

export type IntegrationDomain =
	| "newsletter"
	| "analytics"
	| "ab-testing"
	| "search"
	| "cdn-purge"
	| "monitoring"
	| "forms"
	| "deploy-hooks";

export const INTEGRATION_DOMAINS: readonly IntegrationDomain[] = [
	"newsletter",
	"analytics",
	"ab-testing",
	"search",
	"cdn-purge",
	"monitoring",
	"forms",
	"deploy-hooks",
];
