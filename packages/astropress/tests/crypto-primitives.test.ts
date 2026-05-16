import { describe, expect, it } from "vitest";
import {
	bytesToBase64,
	bytesToHex,
	constantTimeEqual,
	createKmacDigest,
	createMlDsaKeyPair,
	hashPasswordArgon2id,
	isArgon2idHash,
	secretKeyToBase64,
	signMlDsaMessage,
	verifyArgon2idPassword,
	verifyMlDsaMessage,
} from "../src/crypto-primitives.js";

describe("bytesToBase64", () => {
	it("encodes bytes to standard base64", () => {
		expect(bytesToBase64(new Uint8Array([104, 105]))).toBe("aGk=");
	});

	it("encodes an empty array to an empty string", () => {
		expect(bytesToBase64(new Uint8Array([]))).toBe("");
	});
});

describe("bytesToHex", () => {
	it("encodes bytes to lowercase hex", () => {
		expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
	});

	it("zero-pads single-digit byte values to two hex chars", () => {
		expect(bytesToHex(new Uint8Array([0, 1, 15, 16]))).toBe("00010f10");
	});

	it("encodes an empty array to an empty string", () => {
		expect(bytesToHex(new Uint8Array([]))).toBe("");
	});
});

describe("constantTimeEqual", () => {
	it("returns true for identical byte arrays", () => {
		expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
	});

	it("returns false for same-length arrays that differ in one byte", () => {
		expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
	});

	it("returns false when the left array is longer than the right", () => {
		expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
	});

	it("returns false when the left array is shorter than the right", () => {
		// left shorter: the loop bound is left.length, so without the early
		// length-mismatch return the shared prefix would compare as equal.
		expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
	});

	it("returns true for two empty arrays", () => {
		expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
	});

	it("detects a mismatch in the first byte", () => {
		expect(constantTimeEqual(new Uint8Array([9, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(false);
	});
});

describe("createKmacDigest", () => {
	it("produces a deterministic 64-char hex digest by default", () => {
		const digest = createKmacDigest("value", "secret", "purpose");
		expect(digest).toMatch(/^[a-f0-9]{64}$/);
		expect(createKmacDigest("value", "secret", "purpose")).toBe(digest);
	});

	it("honours a custom output length", () => {
		expect(createKmacDigest("value", "secret", "purpose", 16)).toMatch(/^[a-f0-9]{32}$/);
	});

	it("domain-separates by purpose tag", () => {
		expect(createKmacDigest("value", "secret", "purpose-a")).not.toBe(
			createKmacDigest("value", "secret", "purpose-b"),
		);
	});

	it("changes when the secret changes", () => {
		expect(createKmacDigest("value", "secret-a", "purpose")).not.toBe(
			createKmacDigest("value", "secret-b", "purpose"),
		);
	});

	it("changes when the value changes", () => {
		expect(createKmacDigest("value-a", "secret", "purpose")).not.toBe(
			createKmacDigest("value-b", "secret", "purpose"),
		);
	});
});

describe("hashPasswordArgon2id / verifyArgon2idPassword / isArgon2idHash", () => {
	it("produces a verifiable v3 argon2id hash", { timeout: 60_000 }, () => {
		const hash = hashPasswordArgon2id("correct-horse", { memoryKiB: 256, iterations: 1 });
		expect(hash.startsWith("v3:argon2id$")).toBe(true);
		expect(isArgon2idHash(hash)).toBe(true);
		expect(verifyArgon2idPassword("correct-horse", hash)).toBe(true);
		expect(verifyArgon2idPassword("wrong-horse", hash)).toBe(false);
	});

	it("embeds the configured cost parameters in the hash string", { timeout: 60_000 }, () => {
		const hash = hashPasswordArgon2id("pw", { iterations: 3, memoryKiB: 512, parallelism: 1 });
		const [prefix, iterations, memory, parallelism] = hash.split("$");
		expect(prefix).toBe("v3:argon2id");
		expect(iterations).toBe("3");
		expect(memory).toBe("512");
		expect(parallelism).toBe("1");
	});

	it("uses default cost parameters when options are omitted", { timeout: 60_000 }, () => {
		const hash = hashPasswordArgon2id("pw");
		const [, iterations, memory, parallelism] = hash.split("$");
		expect(iterations).toBe("2");
		expect(memory).toBe("19456");
		expect(parallelism).toBe("1");
	});

	it("isArgon2idHash rejects non-argon2id strings", () => {
		expect(isArgon2idHash("plain-text")).toBe(false);
		expect(isArgon2idHash("v2:argon2id$x")).toBe(false);
	});

	it("verifyArgon2idPassword rejects a hash without the argon2id prefix", () => {
		expect(verifyArgon2idPassword("pw", "not-a-hash")).toBe(false);
	});

	it("verifyArgon2idPassword rejects a hash with empty segments", () => {
		expect(verifyArgon2idPassword("pw", "v3:argon2id$$$$$")).toBe(false);
	});

	it("verifyArgon2idPassword rejects a hash with non-numeric cost parameters", () => {
		expect(verifyArgon2idPassword("pw", "v3:argon2id$x$y$z$c2FsdA==$aGFzaA==")).toBe(false);
	});

	it("verifyArgon2idPassword returns false when base64 decoding throws", () => {
		expect(verifyArgon2idPassword("pw", "v3:argon2id$2$256$1$!!!bad!!!$!!!bad!!!")).toBe(false);
	});
});

describe("ML-DSA signing", () => {
	it("creates a key pair carrying the verification metadata", () => {
		const pair = createMlDsaKeyPair("key-1");
		expect(pair.keyId).toBe("key-1");
		expect(pair.verification).toEqual({
			algorithm: "ML-DSA-65",
			keyId: "key-1",
			publicKey: bytesToBase64(pair.publicKey),
			encoding: "base64",
		});
	});

	it("verifies a signature produced for the matching message and key", () => {
		const pair = createMlDsaKeyPair("key-2");
		const secretKeyBase64 = secretKeyToBase64(pair.secretKey);
		const signature = signMlDsaMessage("hello world", secretKeyBase64);
		expect(verifyMlDsaMessage("hello world", signature, pair.verification.publicKey)).toBe(true);
	});

	it("rejects a signature checked against a different message", () => {
		const pair = createMlDsaKeyPair("key-3");
		const signature = signMlDsaMessage("original", secretKeyToBase64(pair.secretKey));
		expect(verifyMlDsaMessage("tampered", signature, pair.verification.publicKey)).toBe(false);
	});

	it("secretKeyToBase64 matches bytesToBase64", () => {
		const pair = createMlDsaKeyPair("key-4");
		expect(secretKeyToBase64(pair.secretKey)).toBe(bytesToBase64(pair.secretKey));
	});
});
