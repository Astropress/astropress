/**
 * Single sanitizer for `connected_integrations.last_error` writes and
 * for any error surface the integration UX returns to the browser.
 *
 * Provider verify() callbacks can throw with arbitrary upstream-API
 * payload data (status text, response bodies). Storing or returning
 * those raw bodies risks leaking auth tokens, account names, or
 * internal endpoint URLs through the audit trail / Playwright traces.
 *
 * Every write to last_error or error path must route through
 * `sanitizeIntegrationError` so the column only contains a typed code
 * the UI can localise. The audit at
 * tooling/scripts/audit-integration-secrets.ts enforces this.
 */

export type IntegrationErrorCode =
	| "INTEGRATION_VERIFY_FAILED"
	| "INTEGRATION_TIMEOUT"
	| "INTEGRATION_AUTH_REJECTED"
	| "INTEGRATION_NOT_FOUND"
	| "INTEGRATION_RATE_LIMITED"
	| "INTEGRATION_NETWORK_ERROR"
	| "INTEGRATION_UNKNOWN_ERROR";

const KNOWN_CODES: ReadonlySet<IntegrationErrorCode> = new Set([
	"INTEGRATION_VERIFY_FAILED",
	"INTEGRATION_TIMEOUT",
	"INTEGRATION_AUTH_REJECTED",
	"INTEGRATION_NOT_FOUND",
	"INTEGRATION_RATE_LIMITED",
	"INTEGRATION_NETWORK_ERROR",
	"INTEGRATION_UNKNOWN_ERROR",
]);

export function isIntegrationErrorCode(
	value: unknown,
): value is IntegrationErrorCode {
	return (
		typeof value === "string" && KNOWN_CODES.has(value as IntegrationErrorCode)
	);
}

/**
 * Reduce an arbitrary error to one of the known codes. The original
 * error message is intentionally discarded — only typed codes are
 * permitted to reach the database or HTTP response body.
 */
export function sanitizeIntegrationError(
	err: unknown,
	hint?: IntegrationErrorCode,
): IntegrationErrorCode {
	if (hint && KNOWN_CODES.has(hint)) return hint;
	if (err && typeof err === "object" && "code" in err) {
		const code = (err as { code: unknown }).code;
		if (isIntegrationErrorCode(code)) return code;
	}
	if (err instanceof Error) {
		// Map common network/timeout shapes without relaying message text.
		const name = err.name;
		if (name === "AbortError" || name === "TimeoutError") {
			return "INTEGRATION_TIMEOUT";
		}
		if (name === "TypeError") {
			return "INTEGRATION_NETWORK_ERROR";
		}
	}
	return "INTEGRATION_UNKNOWN_ERROR";
}
