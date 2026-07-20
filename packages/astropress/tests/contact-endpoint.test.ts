import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRecordAudit } = vi.hoisted(() => ({
	mockRecordAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/d1-audit.js", () => ({
	recordD1Audit: mockRecordAudit,
}));

// Rate limit + Turnstile default to permissive so the happy-path tests are
// unaffected; individual tests override to assert throttle/challenge.
const { mockCheckRateLimit, mockSubmitContact, mockVerifyTurnstile } = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn().mockResolvedValue(true),
	mockSubmitContact: vi.fn(),
	mockVerifyTurnstile: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../src/runtime-mutation-store.js", () => ({
	checkRuntimeRateLimit: mockCheckRateLimit,
	submitRuntimeContact: mockSubmitContact,
}));
vi.mock("../src/turnstile.js", () => ({
	verifyTurnstileToken: mockVerifyTurnstile,
}));

import { POST as pagePost } from "../pages/ap/contact.js";
import { POST } from "../src/contact-endpoint.js";

const MOCK_LOCALS = {} as App.Locals;

const VALID_FIELDS = {
	name: "Ada Lovelace",
	email: "ada@example.com",
	message: "I would like to request an appointment.",
};

function jsonRequest(body: unknown): Request {
	return new Request("http://localhost/ap/contact", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function formRequest(fields: Record<string, string>): Request {
	return new Request("http://localhost/ap/contact", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(fields).toString(),
	});
}

async function post(request: Request): Promise<Response> {
	return POST({ request, locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
}

describe("POST /ap/contact", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue(true);
		mockVerifyTurnstile.mockResolvedValue({ ok: true });
		mockSubmitContact.mockResolvedValue({
			ok: true,
			submission: { id: "contact-1", ...VALID_FIELDS, submittedAt: "2026-07-20T00:00:00.000Z" },
		});
	});

	it("is what the /ap/contact page entrypoint exposes", () => {
		expect(pagePost).toBe(POST);
	});

	it("stores a valid JSON submission and returns 200", async () => {
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		expect(await res.json()).toMatchObject({ ok: true });
		expect(mockSubmitContact).toHaveBeenCalledWith(
			expect.objectContaining({
				name: VALID_FIELDS.name,
				email: VALID_FIELDS.email,
				message: VALID_FIELDS.message,
				submittedAt: expect.any(String),
			}),
			MOCK_LOCALS,
		);
	});

	it("stores a valid form-encoded submission and returns 200", async () => {
		const res = await post(formRequest(VALID_FIELDS));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
		expect(mockSubmitContact).toHaveBeenCalledOnce();
	});

	it("records an audit event for the stored submission", async () => {
		await post(jsonRequest(VALID_FIELDS));
		expect(mockRecordAudit).toHaveBeenCalledWith(
			MOCK_LOCALS,
			{ email: "public", role: "editor", name: "Public visitor" },
			"contact.submit",
			"forms",
			"contact-1",
			expect.stringContaining(VALID_FIELDS.email),
		);
	});

	it("trims surrounding whitespace from submitted fields", async () => {
		await post(
			jsonRequest({
				name: "  Ada Lovelace  ",
				email: "  ada@example.com  ",
				message: "  I would like to request an appointment.  ",
			}),
		);
		expect(mockSubmitContact).toHaveBeenCalledWith(
			expect.objectContaining({
				name: VALID_FIELDS.name,
				email: VALID_FIELDS.email,
				message: VALID_FIELDS.message,
			}),
			MOCK_LOCALS,
		);
	});

	it("accepts fields at exactly the length limits", async () => {
		const res = await post(
			jsonRequest({ ...VALID_FIELDS, name: "x".repeat(200), message: "x".repeat(5000) }),
		);
		expect(res.status).toBe(200);
		expect(mockSubmitContact).toHaveBeenCalledOnce();
	});

	it("returns 400 for invalid JSON", async () => {
		const res = await post(
			new Request("http://localhost/ap/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{nope",
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBeTruthy();
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("returns 400 when the request has no content-type header at all", async () => {
		const res = await post(new Request("http://localhost/ap/contact", { method: "POST" }));
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBeTruthy();
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("returns 400 for an unparseable form body", async () => {
		const res = await post(
			new Request("http://localhost/ap/contact", {
				method: "POST",
				headers: { "Content-Type": "multipart/form-data" },
				body: "not-a-form",
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBeTruthy();
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it.each([
		["missing name", { ...VALID_FIELDS, name: "" }],
		["overlong name", { ...VALID_FIELDS, name: "x".repeat(201) }],
		["missing email", { ...VALID_FIELDS, email: "" }],
		["invalid email", { ...VALID_FIELDS, email: "not-an-email" }],
		["missing message", { ...VALID_FIELDS, message: "" }],
		["overlong message", { ...VALID_FIELDS, message: "x".repeat(5001) }],
	])("returns 400 for %s", async (_label, fields) => {
		const res = await post(jsonRequest(fields));
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.ok).toBe(false);
		expect(typeof body.error).toBe("string");
		expect(body.error).toBeTruthy();
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("honeypot: returns 200 but stores nothing when `website` is filled", async () => {
		const res = await post(jsonRequest({ ...VALID_FIELDS, website: "https://spam.example" }));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		expect(await res.json()).toMatchObject({ ok: true });
		expect(mockSubmitContact).not.toHaveBeenCalled();
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
	});

	it("rate-limits by the CF-Connecting-IP client address", async () => {
		const request = jsonRequest(VALID_FIELDS);
		request.headers.set("CF-Connecting-IP", "203.0.113.9");
		await post(request);
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"contact:ip:203.0.113.9",
			expect.any(Number),
			expect.any(Number),
			MOCK_LOCALS,
		);
		expect(mockVerifyTurnstile).toHaveBeenCalledWith(
			expect.objectContaining({ ipAddress: "203.0.113.9" }),
		);
	});

	it('falls back to the first X-Forwarded-For hop, then to "unknown"', async () => {
		const forwarded = jsonRequest(VALID_FIELDS);
		forwarded.headers.set("X-Forwarded-For", " 198.51.100.7 , 203.0.113.9");
		await post(forwarded);
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"contact:ip:198.51.100.7",
			expect.any(Number),
			expect.any(Number),
			MOCK_LOCALS,
		);

		mockCheckRateLimit.mockClear();
		await post(jsonRequest(VALID_FIELDS));
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"contact:ip:unknown",
			expect.any(Number),
			expect.any(Number),
			MOCK_LOCALS,
		);
	});

	it("returns 429 when the IP rate limit trips", async () => {
		mockCheckRateLimit.mockImplementation(async (key: string) => !key.startsWith("contact:ip:"));
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(429);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.ok).toBe(false);
		expect(body.error).toBeTruthy();
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("returns 429 when the email rate limit trips", async () => {
		mockCheckRateLimit.mockImplementation(async (key: string) => !key.startsWith("contact:email:"));
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(429);
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("rate-limits by lowercased email so case variants share a window", async () => {
		await post(jsonRequest({ ...VALID_FIELDS, email: "Ada@Example.com" }));
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"contact:email:ada@example.com",
			expect.any(Number),
			expect.any(Number),
			MOCK_LOCALS,
		);
	});

	it("returns 403 with the verifier's error when the Turnstile challenge fails", async () => {
		mockVerifyTurnstile.mockResolvedValue({ ok: false, error: "Challenge failed." });
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ ok: false, error: "Challenge failed." });
		expect(mockSubmitContact).not.toHaveBeenCalled();
	});

	it("returns 403 with a fallback error when the verifier gives none", async () => {
		mockVerifyTurnstile.mockResolvedValue({ ok: false });
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(403);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBeTruthy();
	});

	it("forwards the cf-turnstile-response token to verification", async () => {
		await post(jsonRequest({ ...VALID_FIELDS, "cf-turnstile-response": "tok-123" }));
		expect(mockVerifyTurnstile).toHaveBeenCalledWith(expect.objectContaining({ token: "tok-123" }));
	});

	it("drops a non-string turnstile token instead of forwarding it", async () => {
		await post(jsonRequest({ ...VALID_FIELDS, turnstileToken: 42 }));
		expect(mockVerifyTurnstile).toHaveBeenCalledWith(expect.objectContaining({ token: undefined }));
	});

	it("audit failure does not break the 200 response", async () => {
		mockRecordAudit.mockRejectedValue(new Error("audit down"));
		const res = await post(jsonRequest(VALID_FIELDS));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
	});
});
