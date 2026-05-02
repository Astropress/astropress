import { describe, expect, it } from "vitest";

import {
	verifyGithubWebhookSignature,
	verifyInboundWebhookSignature,
} from "../../../src/integrations/webhooks/inbound";

const SECRET = "shared-webhook-secret";

async function hmacHex(
	algo: "SHA-256" | "SHA-512",
	secret: string,
	body: Uint8Array,
): Promise<string> {
	const keyBytes = new TextEncoder().encode(secret);
	const buf = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(buf).set(keyBytes);
	const key = await crypto.subtle.importKey(
		"raw",
		buf,
		{ name: "HMAC", hash: algo },
		false,
		["sign"],
	);
	const bodyBuf = new ArrayBuffer(body.byteLength);
	new Uint8Array(bodyBuf).set(body);
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: "HMAC", hash: algo }, key, bodyBuf),
	);
	return Array.from(sig)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

describe("verifyInboundWebhookSignature", () => {
	it("accepts a valid HMAC-SHA-256 signature with sha256= prefix", async () => {
		const body = new TextEncoder().encode('{"ref":"refs/heads/main"}');
		const hex = await hmacHex("SHA-256", SECRET, body);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("accepts a valid HMAC-SHA-256 signature without prefix", async () => {
		const body = new TextEncoder().encode("hello");
		const hex = await hmacHex("SHA-256", SECRET, body);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: hex,
			body,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("accepts a valid HMAC-SHA-512 signature with sha512= prefix", async () => {
		const body = new TextEncoder().encode("payload");
		const hex = await hmacHex("SHA-512", SECRET, body);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha512",
			header: `sha512=${hex}`,
			body,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("rejects a forged signature", async () => {
		const body = new TextEncoder().encode("hello");
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${"00".repeat(32)}`,
			body,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("rejects when secret is wrong", async () => {
		const body = new TextEncoder().encode("hello");
		const hex = await hmacHex("SHA-256", SECRET, body);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body,
			secret: "different-secret",
		});
		expect(ok).toBe(false);
	});

	it("rejects when body has been tampered with", async () => {
		const original = new TextEncoder().encode("hello");
		const tampered = new TextEncoder().encode("hellp");
		const hex = await hmacHex("SHA-256", SECRET, original);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body: tampered,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("rejects empty header", async () => {
		const body = new TextEncoder().encode("x");
		expect(
			await verifyInboundWebhookSignature({
				algo: "hmac-sha256",
				header: "",
				body,
				secret: SECRET,
			}),
		).toBe(false);
	});

	it("rejects empty secret", async () => {
		const body = new TextEncoder().encode("x");
		expect(
			await verifyInboundWebhookSignature({
				algo: "hmac-sha256",
				header: `sha256=${"00".repeat(32)}`,
				body,
				secret: "",
			}),
		).toBe(false);
	});

	it("rejects non-hex characters in the signature", async () => {
		const body = new TextEncoder().encode("x");
		expect(
			await verifyInboundWebhookSignature({
				algo: "hmac-sha256",
				header: "sha256=zz",
				body,
				secret: SECRET,
			}),
		).toBe(false);
	});

	it("rejects odd-length hex", async () => {
		const body = new TextEncoder().encode("x");
		expect(
			await verifyInboundWebhookSignature({
				algo: "hmac-sha256",
				header: "sha256=abc",
				body,
				secret: SECRET,
			}),
		).toBe(false);
	});

	it("verifyGithubWebhookSignature defaults to hmac-sha256", async () => {
		const body = new TextEncoder().encode('{"ok":true}');
		const hex = await hmacHex("SHA-256", SECRET, body);
		const ok = await verifyGithubWebhookSignature({
			header: `sha256=${hex}`,
			body,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("rejects mismatched length signatures", async () => {
		// Half-length valid hex won't match a 32-byte HMAC output.
		const body = new TextEncoder().encode("x");
		expect(
			await verifyInboundWebhookSignature({
				algo: "hmac-sha256",
				header: `sha256=${"aa".repeat(16)}`,
				body,
				secret: SECRET,
			}),
		).toBe(false);
	});
});
