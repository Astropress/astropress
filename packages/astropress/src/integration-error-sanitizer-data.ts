// stryker-disable-file: data-only — pure code list / Set membership table.
// Mutating the literal members would only make the type signature lie about
// itself; KNOWN_CODES is the type's runtime mirror and is exercised through
// the consumer in integration-error-sanitizer.ts.

export type IntegrationErrorCode =
	| "INTEGRATION_VERIFY_FAILED"
	| "INTEGRATION_TIMEOUT"
	| "INTEGRATION_AUTH_REJECTED"
	| "INTEGRATION_NOT_FOUND"
	| "INTEGRATION_RATE_LIMITED"
	| "INTEGRATION_NETWORK_ERROR"
	| "INTEGRATION_UNKNOWN_ERROR";

export const KNOWN_INTEGRATION_ERROR_CODES: ReadonlySet<IntegrationErrorCode> = new Set([
	"INTEGRATION_VERIFY_FAILED",
	"INTEGRATION_TIMEOUT",
	"INTEGRATION_AUTH_REJECTED",
	"INTEGRATION_NOT_FOUND",
	"INTEGRATION_RATE_LIMITED",
	"INTEGRATION_NETWORK_ERROR",
	"INTEGRATION_UNKNOWN_ERROR",
]);
