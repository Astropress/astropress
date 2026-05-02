import { describe, expect, it } from "vitest";

import {
	algorithmHashName,
	algorithmHeaderPrefix,
	computeWebhookHmacBytes,
	extractWebhookHexSignature,
	parseWebhookHexBytes,
	verifyGithubWebhookSignature,
	verifyInboundWebhookSignature,
} from "../../../src/integrations/webhooks/inbound";

const SECRET = "shh-its-a-secret";
const BODY = new TextEncoder().encode('{"event":"push"}');

async function signHex(
	algo: "hmac-sha256" | "hmac-sha512",
	secret: string,
	body: Uint8Array,
): Promise<string> {
	const sig = await computeWebhookHmacBytes(algo, secret, body);
	return Array.from(sig)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

describe("algorithmHashName", () => {
	it("maps hmac-sha256 to SHA-256", () => {
		expect(algorithmHashName("hmac-sha256")).toBe("SHA-256");
	});
	it("maps hmac-sha512 to SHA-512", () => {
		expect(algorithmHashName("hmac-sha512")).toBe("SHA-512");
	});
});

describe("algorithmHeaderPrefix", () => {
	it("maps hmac-sha256 to 'sha256='", () => {
		expect(algorithmHeaderPrefix("hmac-sha256")).toBe("sha256=");
	});
	it("maps hmac-sha512 to 'sha512='", () => {
		expect(algorithmHeaderPrefix("hmac-sha512")).toBe("sha512=");
	});
});

describe("extractWebhookHexSignature", () => {
	it("strips the sha256= prefix when present", () => {
		expect(extractWebhookHexSignature("sha256=abcdef", "hmac-sha256")).toBe(
			"abcdef",
		);
	});
	it("strips the sha512= prefix when present", () => {
		expect(extractWebhookHexSignature("sha512=abcdef", "hmac-sha512")).toBe(
			"abcdef",
		);
	});
	it("returns the input unchanged when the prefix is absent", () => {
		expect(extractWebhookHexSignature("abcdef", "hmac-sha256")).toBe("abcdef");
	});
	it("does not strip a sha512= prefix when algo is hmac-sha256", () => {
		expect(extractWebhookHexSignature("sha512=abcdef", "hmac-sha256")).toBe(
			"sha512=abcdef",
		);
	});
	it("returns empty when the entire input is the prefix", () => {
		expect(extractWebhookHexSignature("sha256=", "hmac-sha256")).toBe("");
	});
});

describe("parseWebhookHexBytes", () => {
	it("parses a valid even-length hex string", () => {
		const out = parseWebhookHexBytes("deadbeef");
		expect(out).not.toBeNull();
		expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});
	it("accepts uppercase hex", () => {
		const out = parseWebhookHexBytes("DEADBEEF");
		expect(out).not.toBeNull();
		expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});
	it("returns null on empty input", () => {
		expect(parseWebhookHexBytes("")).toBeNull();
	});
	it("returns null on odd-length input", () => {
		expect(parseWebhookHexBytes("abc")).toBeNull();
	});
	it("returns null on non-hex characters", () => {
		expect(parseWebhookHexBytes("zz")).toBeNull();
	});
	it("returns null on whitespace inside the value", () => {
		expect(parseWebhookHexBytes("ab cd")).toBeNull();
	});

	it("rejects a hex string with a non-hex prefix (kills regex-anchor mutants)", () => {
		expect(parseWebhookHexBytes("zz0011")).toBeNull();
	});

	it("rejects a hex string with a non-hex suffix (kills regex-anchor mutants)", () => {
		expect(parseWebhookHexBytes("0011zz")).toBeNull();
	});

	it("returns a Uint8Array of length hex.length / 2 (no extra trailing bytes)", () => {
		const out = parseWebhookHexBytes("0011");
		expect((out as Uint8Array).length).toBe(2);
	});

	it("parses every byte of a multi-byte hex string (kills < → <= loop bound mutants)", () => {
		const out = parseWebhookHexBytes("00112233");
		expect(Array.from(out as Uint8Array)).toEqual([0, 0x11, 0x22, 0x33]);
	});
});

describe("verifyInboundWebhookSignature", () => {
	it("returns true for a valid sha256 signature", async () => {
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("returns true for a valid sha512 signature", async () => {
		const hex = await signHex("hmac-sha512", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha512",
			header: `sha512=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("returns true when the header has no algorithm prefix but is otherwise valid hex", async () => {
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: hex,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("returns false on a forged signature (wrong secret)", async () => {
		const hex = await signHex("hmac-sha256", "different-secret", BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on a tampered body (signature for different bytes)", async () => {
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body: new TextEncoder().encode('{"event":"push","tampered":true}'),
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on algorithm mismatch (signed sha256, verified sha512)", async () => {
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha512",
			header: `sha512=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on empty header", async () => {
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: "",
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on empty secret (the guard is load-bearing — WebCrypto refuses zero-length keys)", async () => {
		// We sign with a real secret so parseWebhookHexBytes accepts the
		// header. Without the empty-secret guard, the WebCrypto key
		// import would throw — the test would still surface the mutant.
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: `sha256=${hex}`,
			body: BODY,
			secret: "",
		});
		expect(ok).toBe(false);
	});

	it("returns false when the header decodes to the wrong byte length", async () => {
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: "sha256=deadbeef",
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on non-hex header content", async () => {
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: "sha256=zzzz",
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});

	it("returns false on odd-length header content", async () => {
		const ok = await verifyInboundWebhookSignature({
			algo: "hmac-sha256",
			header: "sha256=abc",
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});
});

describe("verifyGithubWebhookSignature", () => {
	it("delegates to hmac-sha256 verification", async () => {
		const hex = await signHex("hmac-sha256", SECRET, BODY);
		const ok = await verifyGithubWebhookSignature({
			header: `sha256=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(true);
	});

	it("rejects forged signatures", async () => {
		const hex = await signHex("hmac-sha256", "wrong", BODY);
		const ok = await verifyGithubWebhookSignature({
			header: `sha256=${hex}`,
			body: BODY,
			secret: SECRET,
		});
		expect(ok).toBe(false);
	});
});
