import { describe, expect, it } from "vitest";
import {
	IntegrationSecretError,
	type SealedSecret,
	envelopeSerializedLength,
	openIntegrationSecret,
	sealIntegrationSecret,
} from "../src/integration-secret-envelope";

const ROOT = "root-secret-current-do-not-use-in-prod";
const PREV = "root-secret-previous-do-not-use-in-prod";

const CTX = { domain: "newsletter", provider: "listmonk" } as const;
const FIELDS = { apiKey: "lm-key-CANARY", baseUrl: "https://example.test" };

describe("integration-secret-envelope", () => {
	it("round-trips: seal → open returns identical fields", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const opened = await openIntegrationSecret(sealed, CTX, { current: ROOT });
		expect(opened.fields).toEqual(FIELDS);
		expect(opened.usedKid).toBe("current");
	});

	it("tags fresh seals with kid=current", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		expect(sealed.kid).toBe("current");
		expect(sealed.v).toBe(1);
	});

	it("AAD binds to (domain, provider) — wrong provider fails decrypt", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		await expect(
			openIntegrationSecret(
				sealed,
				{ domain: "newsletter", provider: "mailchimp" },
				{ current: ROOT },
			),
		).rejects.toThrow(IntegrationSecretError);
	});

	it("AAD binds to (domain, provider) — wrong domain fails decrypt", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		await expect(
			openIntegrationSecret(
				sealed,
				{ domain: "analytics", provider: "listmonk" },
				{ current: ROOT },
			),
		).rejects.toThrow(IntegrationSecretError);
	});

	it("tampered ciphertext throws DECRYPT_FAILED", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const tampered: SealedSecret = {
			...sealed,
			ciphertext: flipFirstByte(sealed.ciphertext),
		};
		await expect(
			openIntegrationSecret(tampered, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
	});

	it("tampered dek_wrap throws DECRYPT_FAILED", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const tampered: SealedSecret = {
			...sealed,
			dek_wrap: flipFirstByte(sealed.dek_wrap),
		};
		await expect(
			openIntegrationSecret(tampered, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
	});

	it("tampered IVs throw DECRYPT_FAILED", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const wrapTampered: SealedSecret = {
			...sealed,
			wrap_iv: flipFirstByte(sealed.wrap_iv),
		};
		await expect(
			openIntegrationSecret(wrapTampered, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
		const dataTampered: SealedSecret = {
			...sealed,
			data_iv: flipFirstByte(sealed.data_iv),
		};
		await expect(
			openIntegrationSecret(dataTampered, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
	});

	it("opens against previous key when current rejects", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, PREV);
		// Mark as previous-rooted so the opener knows which slot to try.
		const rotated: SealedSecret = { ...sealed, kid: "previous" };
		const opened = await openIntegrationSecret(rotated, CTX, {
			current: ROOT,
			previous: PREV,
		});
		expect(opened.fields).toEqual(FIELDS);
		expect(opened.usedKid).toBe("previous");
	});

	it("falls back across slots when sealed.kid points at a missing key", async () => {
		// Seal under the current key but mislabel the kid as "previous"
		// (simulating a corrupted record). Open should still succeed by
		// trying both slots.
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const mislabeled: SealedSecret = { ...sealed, kid: "previous" };
		const opened = await openIntegrationSecret(mislabeled, CTX, {
			current: ROOT,
			previous: PREV,
		});
		expect(opened.fields).toEqual(FIELDS);
		expect(opened.usedKid).toBe("current");
	});

	it("rejects when neither key matches", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		await expect(
			openIntegrationSecret(sealed, CTX, {
				current: "not-the-key",
				previous: "also-not-the-key",
			}),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
	});

	it("rejects unknown envelope version", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const future = { ...sealed, v: 999 } as unknown as SealedSecret;
		await expect(
			openIntegrationSecret(future, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });
	});

	it("rejects an invalid kid value", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const broken = { ...sealed, kid: "antique" } as unknown as SealedSecret;
		await expect(
			openIntegrationSecret(broken, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });
	});

	it("rejects empty rootSecret on seal", async () => {
		await expect(sealIntegrationSecret(FIELDS, CTX, "")).rejects.toMatchObject({
			code: "INVALID_ENVELOPE",
		});
	});

	it("two seals of identical input differ in nonces and ciphertext", async () => {
		const a = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const b = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		expect(a.wrap_iv).not.toBe(b.wrap_iv);
		expect(a.data_iv).not.toBe(b.data_iv);
		expect(a.wrap_salt).not.toBe(b.wrap_salt);
		expect(a.dek_wrap).not.toBe(b.dek_wrap);
		expect(a.ciphertext).not.toBe(b.ciphertext);
	});

	it("base64 fields contain only standard base64 alphabet", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const safe = /^[A-Za-z0-9+/=]+$/;
		for (const field of [
			sealed.wrap_salt,
			sealed.wrap_iv,
			sealed.dek_wrap,
			sealed.data_iv,
			sealed.ciphertext,
		]) {
			expect(field).toMatch(safe);
		}
	});

	it("envelope JSON shape has exactly the documented keys", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		expect(Object.keys(sealed).sort()).toEqual(
			[
				"ciphertext",
				"data_iv",
				"dek_wrap",
				"kid",
				"v",
				"wrap_iv",
				"wrap_salt",
			].sort(),
		);
	});

	it("serialized envelope stays well under D1's 1MiB row budget", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		expect(envelopeSerializedLength(sealed)).toBeLessThan(1024);
	});

	it("rejects payload sealed as a primitive (not an object)", async () => {
		const sealed = await sealIntegrationSecret(
			"not-an-object" as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_PLAINTEXT" });
	});

	it("rejects payload sealed as null (typeof object but falsy)", async () => {
		const sealed = await sealIntegrationSecret(
			null as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_PLAINTEXT" });
	});

	it("rejects payload sealed as an array", async () => {
		const sealed = await sealIntegrationSecret(
			["a", "b"] as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_PLAINTEXT" });
	});

	it("rejects payload with a non-string value", async () => {
		const sealed = await sealIntegrationSecret(
			{ apiKey: 123 } as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_PLAINTEXT" });
	});

	it("INVALID_ENVELOPE error messages name the offending field", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const future = { ...sealed, v: 999 } as unknown as SealedSecret;
		const broken = { ...sealed, kid: "antique" } as unknown as SealedSecret;
		await expect(
			openIntegrationSecret(future, CTX, { current: ROOT }),
		).rejects.toMatchObject({
			message: expect.stringContaining("envelope version"),
		});
		await expect(
			openIntegrationSecret(broken, CTX, { current: ROOT }),
		).rejects.toMatchObject({
			message: expect.stringContaining("envelope kid"),
		});
	});

	it("DECRYPT_FAILED error message names domain/provider context", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: "bad-key" }),
		).rejects.toMatchObject({
			message: expect.stringMatching(/newsletter\/listmonk/),
		});
	});

	it("seal() error message names the function on empty rootSecret", async () => {
		await expect(sealIntegrationSecret(FIELDS, CTX, "")).rejects.toMatchObject({
			message: expect.stringContaining("sealIntegrationSecret"),
		});
	});

	it("base64 round-trip survives every padding length (0/1/2 chars)", async () => {
		const cases = [
			{ apiKey: "" },
			{ apiKey: "x" },
			{ apiKey: "xx" },
			{ apiKey: "xxx" },
			{ apiKey: "xxxxx" },
		];
		for (const fields of cases) {
			const sealed = await sealIntegrationSecret(fields, CTX, ROOT);
			const opened = await openIntegrationSecret(sealed, CTX, {
				current: ROOT,
			});
			expect(opened.fields).toEqual(fields);
		}
	});

	it("opens against current when sealed.kid='previous' but only current matches", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const mislabeled: SealedSecret = { ...sealed, kid: "previous" };
		const opened = await openIntegrationSecret(mislabeled, CTX, {
			current: ROOT,
		});
		expect(opened.fields).toEqual(FIELDS);
		expect(opened.usedKid).toBe("current");
	});

	it("rejects when sealed.kid='previous' and only current is supplied and doesn't match", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, PREV);
		const labeled: SealedSecret = { ...sealed, kid: "previous" };
		await expect(
			openIntegrationSecret(labeled, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
	});

	it("thrown errors carry name='IntegrationSecretError'", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		try {
			await openIntegrationSecret(sealed, CTX, { current: "wrong" });
			throw new Error("expected throw");
		} catch (err) {
			expect((err as Error).name).toBe("IntegrationSecretError");
		}
	});

	it("DECRYPT_FAILED on tampered ciphertext mentions 'authentication failed'", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const tampered: SealedSecret = {
			...sealed,
			ciphertext: flipFirstByte(sealed.ciphertext),
		};
		await expect(
			openIntegrationSecret(tampered, CTX, { current: ROOT }),
		).rejects.toMatchObject({
			message: expect.stringContaining("authentication failed"),
		});
	});

	it("DECRYPT_FAILED on no-key-match mentions 'unable to decrypt'", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: "wrong" }),
		).rejects.toMatchObject({
			message: expect.stringContaining("unable to decrypt"),
		});
	});

	it("INVALID_PLAINTEXT (non-object) mentions 'flat string-valued object'", async () => {
		const sealed = await sealIntegrationSecret(
			"not-an-object" as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({
			message: expect.stringContaining("flat string-valued object"),
		});
	});

	it("rejects payload with mixed-type values (one string, one number)", async () => {
		// Targets the `Object.values(...).some()` predicate: a `.every()` mutant
		// would let this mixed payload through; `.some()` correctly flags it.
		const sealed = await sealIntegrationSecret(
			{ apiKey: "ok", count: 7 } as unknown as Record<string, string>,
			CTX,
			ROOT,
		);
		await expect(
			openIntegrationSecret(sealed, CTX, { current: ROOT }),
		).rejects.toMatchObject({ code: "INVALID_PLAINTEXT" });
	});

	it("opens with only previous slot supplied (no current key)", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, PREV);
		const labeled: SealedSecret = { ...sealed, kid: "previous" };
		const opened = await openIntegrationSecret(labeled, CTX, {
			previous: PREV,
		} as { current: string; previous?: string });
		expect(opened.fields).toEqual(FIELDS);
		expect(opened.usedKid).toBe("previous");
	});

	it("envelope JSON encoding has the documented keys with correct types", async () => {
		const sealed = await sealIntegrationSecret(FIELDS, CTX, ROOT);
		const json = JSON.stringify(sealed);
		expect(json).toContain('"v":1');
		expect(json).toContain('"kid":"current"');
		expect(json).toMatch(/"wrap_salt":"[A-Za-z0-9+/=]+"/);
		expect(json).toMatch(/"wrap_iv":"[A-Za-z0-9+/=]+"/);
		expect(json).toMatch(/"dek_wrap":"[A-Za-z0-9+/=]+"/);
		expect(json).toMatch(/"data_iv":"[A-Za-z0-9+/=]+"/);
		expect(json).toMatch(/"ciphertext":"[A-Za-z0-9+/=]+"/);
	});
});

function flipFirstByte(b64url: string): string {
	const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const binary = atob(padded + "=".repeat(padLen));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	bytes[0] = bytes[0] ^ 0x01;
	let out = "";
	for (const byte of bytes) out += String.fromCharCode(byte);
	return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
