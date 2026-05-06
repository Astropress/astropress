import { describe, expect, it } from "vitest";
import {
	isIntegrationErrorCode,
	sanitizeIntegrationError,
} from "../src/integration-error-sanitizer";

describe("sanitizeIntegrationError", () => {
	it("returns the explicit hint when valid", () => {
		expect(sanitizeIntegrationError(new Error("upstream"), "INTEGRATION_AUTH_REJECTED")).toBe(
			"INTEGRATION_AUTH_REJECTED",
		);
	});

	it("recognises typed `code` on the thrown object", () => {
		expect(sanitizeIntegrationError({ code: "INTEGRATION_RATE_LIMITED" })).toBe(
			"INTEGRATION_RATE_LIMITED",
		);
	});

	it("maps AbortError → INTEGRATION_TIMEOUT", () => {
		const err = new Error("aborted");
		err.name = "AbortError";
		expect(sanitizeIntegrationError(err)).toBe("INTEGRATION_TIMEOUT");
	});

	it("maps TypeError (fetch failure shape) → INTEGRATION_NETWORK_ERROR", () => {
		const err = new TypeError("Failed to fetch");
		expect(sanitizeIntegrationError(err)).toBe("INTEGRATION_NETWORK_ERROR");
	});

	it("falls back to INTEGRATION_UNKNOWN_ERROR for arbitrary thrown values", () => {
		expect(sanitizeIntegrationError("upstream-401-credentials-leaked")).toBe(
			"INTEGRATION_UNKNOWN_ERROR",
		);
		expect(sanitizeIntegrationError(undefined)).toBe("INTEGRATION_UNKNOWN_ERROR");
		expect(sanitizeIntegrationError(new Error("Bearer abcd1234"))).toBe(
			"INTEGRATION_UNKNOWN_ERROR",
		);
	});

	it("never echoes the original error message", () => {
		const code = sanitizeIntegrationError(new Error("API_KEY=sk-secret-do-not-leak"));
		expect(code).not.toContain("sk-secret-do-not-leak");
		expect(code).not.toContain("API_KEY");
	});

	it("isIntegrationErrorCode rejects arbitrary strings", () => {
		expect(isIntegrationErrorCode("INTEGRATION_VERIFY_FAILED")).toBe(true);
		expect(isIntegrationErrorCode("anything-else")).toBe(false);
		expect(isIntegrationErrorCode(undefined)).toBe(false);
	});

	it("isIntegrationErrorCode rejects non-string types", () => {
		expect(isIntegrationErrorCode(123)).toBe(false);
		expect(isIntegrationErrorCode({})).toBe(false);
		expect(isIntegrationErrorCode(null)).toBe(false);
	});

	it("rejects an unknown hint string and falls through to typed code lookup", () => {
		const code = sanitizeIntegrationError(
			{ code: "INTEGRATION_VERIFY_FAILED" },
			"NOT_A_REAL_CODE" as never,
		);
		expect(code).toBe("INTEGRATION_VERIFY_FAILED");
	});

	it("ignores objects whose `code` is not a known IntegrationErrorCode", () => {
		expect(sanitizeIntegrationError({ code: "garbage-code" })).toBe("INTEGRATION_UNKNOWN_ERROR");
	});

	it("falls through when err is an object without `code` property", () => {
		expect(sanitizeIntegrationError({ unrelated: true })).toBe("INTEGRATION_UNKNOWN_ERROR");
	});

	it("maps TimeoutError → INTEGRATION_TIMEOUT", () => {
		const err = new Error("timed out");
		err.name = "TimeoutError";
		expect(sanitizeIntegrationError(err)).toBe("INTEGRATION_TIMEOUT");
	});

	it("non-matching error names fall through to INTEGRATION_UNKNOWN_ERROR", () => {
		const err = new Error("generic");
		err.name = "RangeError";
		expect(sanitizeIntegrationError(err)).toBe("INTEGRATION_UNKNOWN_ERROR");
	});

	it("null and primitive throws fall through to INTEGRATION_UNKNOWN_ERROR", () => {
		expect(sanitizeIntegrationError(null)).toBe("INTEGRATION_UNKNOWN_ERROR");
		expect(sanitizeIntegrationError(42)).toBe("INTEGRATION_UNKNOWN_ERROR");
	});
});
