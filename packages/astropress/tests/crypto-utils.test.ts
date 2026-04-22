import { describe, expect, it } from "vitest";
import {
	createSessionTokenDigest,
	hashPassword,
	verifyPassword,
} from "../src/crypto-utils.js";

describe("session token digest", () => {
	it("produces a deterministic hex digest that does not equal the raw token", async () => {
		const token = "session-token";
		const secret = "replace-with-a-long-random-session-secret";

		const first = await createSessionTokenDigest(token, secret);
		const second = await createSessionTokenDigest(token, secret);

		expect(first).toBe(second);
		expect(first).not.toBe(token);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe("hashPassword / verifyPassword", () => {
	it("verifies a freshly hashed password", async () => {
		const hash = await hashPassword("correct-horse-battery");
		expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	}, 15000);

	it("returns false for a malformed hash (no dollar-sign separators)", async () => {
		expect(await verifyPassword("password", "not-a-valid-hash")).toBe(false);
	});

	it("returns false when hash parts are empty (missing iterations)", async () => {
		expect(await verifyPassword("password", "$$")).toBe(false);
	});

	it("returns false when the stored hash has a truncated hash segment (length mismatch triggers constantTimeEqual short-circuit)", async () => {
		// Build a real hash then corrupt the third segment to a shorter base64
		const real = await hashPassword("password");
		const [iter, salt] = real.split("$");
		const corrupted = `${iter}$${salt}$YWJj`; // "abc" in base64 — much shorter than 64-byte hash
		expect(await verifyPassword("password", corrupted)).toBe(false);
	});

	it("returns false when base64 decode throws (catch branch)", async () => {
		// A stored hash where base64 decoding the salt would throw (invalid base64 chars)
		expect(await verifyPassword("password", "100000$!!!invalid!!!$aaaa")).toBe(
			false,
		);
	});
});
