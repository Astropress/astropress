import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { receiveInboundWebhook } from "../../../src/integrations/webhooks/receiver";
import {
	_resetInboundWebhookRegistryForTests,
	registerInboundWebhookProvider,
} from "../../../src/integrations/webhooks/registry";

const SECRET = "super-secret";
const BODY_TEXT = '{"action":"opened","number":42}';
const BODY = new TextEncoder().encode(BODY_TEXT);

async function signGithubBody(body: Uint8Array, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, body);
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `sha256=${hex}`;
}

function headerLookup(map: Record<string, string>): (name: string) => string | null {
	return (name) => {
		const lower = name.toLowerCase();
		for (const [k, v] of Object.entries(map)) {
			if (k.toLowerCase() === lower) return v;
		}
		return null;
	};
}

beforeEach(() => {
	registerInboundWebhookProvider({
		id: "github",
		label: "GitHub",
		signatureHeader: "X-Hub-Signature-256",
		algorithm: "hmac-sha256",
		eventHeader: "X-GitHub-Event",
	});
});

afterEach(() => _resetInboundWebhookRegistryForTests());

describe("receiveInboundWebhook — happy path", () => {
	it("returns ok with provider + eventName when signature verifies and event header is present", async () => {
		const sig = await signGithubBody(BODY, SECRET);
		const r = await receiveInboundWebhook({
			providerId: "github",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "pull_request",
			}),
		});
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.provider.id).toBe("github");
			expect(r.eventName).toBe("pull_request");
		}
	});

	it("returns ok with eventName=null when the provider has no eventHeader", async () => {
		_resetInboundWebhookRegistryForTests();
		registerInboundWebhookProvider({
			id: "anon",
			label: "Anon",
			signatureHeader: "X-Sig",
			algorithm: "hmac-sha256",
		});
		// Re-sign body using a known shape: raw hex (no prefix).
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(SECRET),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sigBytes = await crypto.subtle.sign("HMAC", key, BODY);
		const hex = Array.from(new Uint8Array(sigBytes))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		const r = await receiveInboundWebhook({
			providerId: "anon",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({ "X-Sig": `sha256=${hex}` }),
		});
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.eventName).toBeNull();
	});
});

describe("receiveInboundWebhook — error branches", () => {
	it("returns RECEIVER_UNKNOWN_PROVIDER for an unregistered id", async () => {
		const r = await receiveInboundWebhook({
			providerId: "stripe",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({}),
		});
		expect(r).toEqual({ ok: false, code: "RECEIVER_UNKNOWN_PROVIDER" });
	});

	it("returns RECEIVER_MISSING_SIGNATURE when the signature header is absent", async () => {
		const r = await receiveInboundWebhook({
			providerId: "github",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({}),
		});
		expect(r).toEqual({ ok: false, code: "RECEIVER_MISSING_SIGNATURE" });
	});

	it("returns RECEIVER_MISSING_SIGNATURE when the signature header is empty", async () => {
		const r = await receiveInboundWebhook({
			providerId: "github",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({ "X-Hub-Signature-256": "" }),
		});
		expect(r).toEqual({ ok: false, code: "RECEIVER_MISSING_SIGNATURE" });
	});

	it("returns RECEIVER_INVALID_SIGNATURE when the signature does not match", async () => {
		const sig = await signGithubBody(BODY, "WRONG-SECRET");
		const r = await receiveInboundWebhook({
			providerId: "github",
			bodyBytes: BODY,
			secret: SECRET,
			headers: headerLookup({
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "ping",
			}),
		});
		expect(r).toEqual({ ok: false, code: "RECEIVER_INVALID_SIGNATURE" });
	});

	it("returns RECEIVER_INVALID_SIGNATURE when the body has been tampered with", async () => {
		const sig = await signGithubBody(BODY, SECRET);
		const r = await receiveInboundWebhook({
			providerId: "github",
			bodyBytes: new TextEncoder().encode(`${BODY_TEXT}!`),
			secret: SECRET,
			headers: headerLookup({
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "ping",
			}),
		});
		expect(r).toEqual({ ok: false, code: "RECEIVER_INVALID_SIGNATURE" });
	});
});
