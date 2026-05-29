import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the newsletter adapter and audit logger before importing the endpoint
vi.mock("../src/newsletter-adapter.js", () => ({
	newsletterAdapter: {
		subscribe: vi.fn(),
	},
}));

const { mockRecordAudit } = vi.hoisted(() => ({
	mockRecordAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/d1-audit.js", () => ({
	recordD1Audit: mockRecordAudit,
}));

// #136: rate limit + Turnstile. Default to permissive so the existing happy-path
// tests are unaffected; individual tests override to assert throttle/challenge.
const { mockCheckRateLimit, mockVerifyTurnstile } = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn().mockResolvedValue(true),
	mockVerifyTurnstile: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../src/runtime-mutation-store.js", () => ({
	checkRuntimeRateLimit: mockCheckRateLimit,
}));
vi.mock("../src/turnstile.js", () => ({
	verifyTurnstileToken: mockVerifyTurnstile,
}));

import { POST } from "../pages/ap/newsletter/subscribe.js";
import { newsletterAdapter } from "../src/newsletter-adapter.js";

const mockSubscribe = newsletterAdapter.subscribe as ReturnType<typeof vi.fn>;

const MOCK_LOCALS = {} as App.Locals;

function jsonRequest(body: unknown): Request {
	return new Request("http://localhost/ap/newsletter/subscribe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function formRequest(email: string): Request {
	const params = new URLSearchParams({ email });
	return new Request("http://localhost/ap/newsletter/subscribe", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	});
}

describe("POST /ap/newsletter/subscribe", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSubscribe.mockResolvedValue({ ok: true });
		mockRecordAudit.mockResolvedValue(undefined);
		mockCheckRateLimit.mockResolvedValue(true);
		mockVerifyTurnstile.mockResolvedValue({ ok: true });
	});

	it("returns 200 ok for a valid JSON email", async () => {
		const res = await POST({
			request: jsonRequest({ email: "user@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: true });
		expect(mockSubscribe).toHaveBeenCalledWith("user@example.com", MOCK_LOCALS);
	});

	it("returns 200 ok for a valid form-encoded email", async () => {
		const res = await POST({
			request: formRequest("editor@site.com"),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: true });
		expect(mockSubscribe).toHaveBeenCalledWith("editor@site.com", MOCK_LOCALS);
	});

	it("returns 400 for missing email", async () => {
		const res = await POST({
			request: jsonRequest({}),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: false });
		expect(typeof body.error).toBe("string");
		expect(mockSubscribe).not.toHaveBeenCalled();
	});

	it("returns 400 for invalid email format", async () => {
		const res = await POST({
			request: jsonRequest({ email: "not-an-email" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: false });
		expect(mockSubscribe).not.toHaveBeenCalled();
	});

	it("returns 400 for malformed JSON body", async () => {
		const req = new Request("http://localhost/ap/newsletter/subscribe", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{ invalid json",
		});
		const res = await POST({ request: req, locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: false });
	});

	it("returns 422 when the adapter returns an error", async () => {
		mockSubscribe.mockResolvedValueOnce({
			ok: false,
			error: "Listmonk server unreachable.",
		});
		const res = await POST({
			request: jsonRequest({ email: "user@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(422);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			ok: false,
			error: "Listmonk server unreachable.",
		});
	});

	it("returns 422 with fallback message when adapter error has no message", async () => {
		mockSubscribe.mockResolvedValueOnce({ ok: false });
		const res = await POST({
			request: jsonRequest({ email: "user@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(422);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: false });
		expect(typeof body.error).toBe("string");
	});

	it("trims whitespace from email before validation", async () => {
		const res = await POST({
			request: jsonRequest({ email: "  user@example.com  " }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		expect(mockSubscribe).toHaveBeenCalledWith("user@example.com", MOCK_LOCALS);
	});

	it("returns Content-Type: application/json on all responses", async () => {
		const res = await POST({
			request: jsonRequest({ email: "bad" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("records a newsletter.subscribe conversion audit event on success", async () => {
		const res = await POST({
			request: jsonRequest({ email: "subscriber@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		expect(mockRecordAudit).toHaveBeenCalledWith(
			MOCK_LOCALS,
			expect.objectContaining({ email: "public" }),
			"newsletter.subscribe",
			"newsletter",
			"subscriber@example.com",
			expect.any(String),
		);
	});

	it("includes utm_source in the audit summary when present in query string", async () => {
		const reqWithUtm = new Request("http://localhost/ap/newsletter/subscribe?utm_source=homepage", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "user@example.com" }),
		});
		await POST({ request: reqWithUtm, locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
		expect(mockRecordAudit).toHaveBeenCalledWith(
			MOCK_LOCALS,
			expect.anything(),
			"newsletter.subscribe",
			"newsletter",
			"user@example.com",
			expect.stringContaining("homepage"),
		);
	});

	it("does not record an audit event when subscription fails", async () => {
		mockSubscribe.mockResolvedValueOnce({ ok: false, error: "Adapter error" });
		const res = await POST({
			request: jsonRequest({ email: "user@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(422);
		expect(mockRecordAudit).not.toHaveBeenCalled();
	});

	// ── #136: rate limit + Turnstile ────────────────────────────────────────
	it("happy path: passes both rate-limit windows and a satisfied Turnstile challenge", async () => {
		const res = await POST({
			request: jsonRequest({ email: "user@example.com", "cf-turnstile-response": "tok" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		// Both the per-IP and per-email windows are checked.
		expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
		const keys = mockCheckRateLimit.mock.calls.map((c) => c[0] as string);
		expect(keys.some((k) => k.startsWith("newsletter:ip:"))).toBe(true);
		expect(keys.some((k) => k.startsWith("newsletter:email:"))).toBe(true);
		expect(mockVerifyTurnstile).toHaveBeenCalledOnce();
		expect(mockSubscribe).toHaveBeenCalled();
	});

	it("throttled: returns 429 and never calls the adapter when a rate-limit window trips", async () => {
		// Per-email window trips (second checkRateLimit call resolves false).
		mockCheckRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		const res = await POST({
			request: jsonRequest({ email: "user@example.com" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(429);
		expect(mockSubscribe).not.toHaveBeenCalled();
		expect(mockVerifyTurnstile).not.toHaveBeenCalled();
	});

	it("challenge-failed: returns 403 and never calls the adapter when Turnstile rejects", async () => {
		mockVerifyTurnstile.mockResolvedValueOnce({ ok: false, error: "Security challenge failed." });
		const res = await POST({
			request: jsonRequest({ email: "user@example.com", "cf-turnstile-response": "bad" }),
			locals: MOCK_LOCALS,
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(403);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ ok: false });
		expect(mockSubscribe).not.toHaveBeenCalled();
	});

	it("forwards the submitted Turnstile token and client IP to verification", async () => {
		const req = new Request("http://localhost/ap/newsletter/subscribe", {
			method: "POST",
			headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
			body: JSON.stringify({ email: "user@example.com", "cf-turnstile-response": "the-token" }),
		});
		await POST({ request: req, locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
		expect(mockVerifyTurnstile).toHaveBeenCalledWith(
			expect.objectContaining({ token: "the-token", ipAddress: "203.0.113.7" }),
		);
	});
});
