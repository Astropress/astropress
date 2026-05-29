import { beforeEach, describe, expect, it, vi } from "vitest";
import { isWebhookEvent, validateWebhookCreateInput } from "../src/webhook-validation";
import { WEBHOOK_EVENTS } from "../src/webhook-validation-data";

// For the admin-action parity block below: keep the real shared validator
// (the whole point of issue #141 is that the admin action and the REST API
// run the *same* validation), but replace the auth/session guard with a thin
// shim that hands the handler a real FormData and records fail()/redirect().
// These vi.mock calls are hoisted above the imports; they only intercept the
// barrel import used by the page module, not the direct ../src imports above.
vi.mock("@astropress-diy/astropress", async (importActual) => {
	const actual = await importActual<typeof import("@astropress-diy/astropress")>();
	return {
		...actual,
		withAdminFormAction: async (
			context: { request: Request },
			options: { failurePath: string },
			run: (action: {
				formData: FormData;
				fail: (message: string) => Response;
				redirect: (url: string) => Response;
			}) => Promise<Response> | Response,
		) =>
			run({
				formData: await context.request.formData(),
				fail: (message: string) =>
					new Response(null, {
						status: 303,
						headers: { location: `${options.failurePath}?error=${encodeURIComponent(message)}` },
					}),
				redirect: (url: string) => new Response(null, { status: 303, headers: { location: url } }),
			}),
	};
});

const mockCreate = vi.fn();
const mockFlashPut = vi.fn(async () => ({ id: "flash-test-id" }));
// The real local admin store exposes a `flash` surface (admin_flash table,
// wired by H4 #113/#115/#133); webhook-create resolves it to hand the one-time
// verification material off via the flash store instead of the URL. Mirror
// that surface here so resolveFlashStore() returns a store on the no-DB path.
vi.mock("@astropress-diy/astropress/local-runtime-modules.js", () => ({
	loadLocalAdminStore: vi.fn(async () => ({
		webhooks: { create: mockCreate },
		flash: { put: mockFlashPut, consume: vi.fn(async () => null) },
	})),
}));

import { POST as webhookCreatePOST } from "../pages/ap-admin/actions/webhook-create.js";

describe("isWebhookEvent", () => {
	it("accepts every name in the canonical allowlist", () => {
		for (const event of WEBHOOK_EVENTS) {
			expect(isWebhookEvent(event)).toBe(true);
		}
	});

	it("rejects unknown event names", () => {
		expect(isWebhookEvent("content.created")).toBe(false);
		expect(isWebhookEvent("content.published.extra")).toBe(false);
		expect(isWebhookEvent("")).toBe(false);
	});

	it("rejects non-string values", () => {
		expect(isWebhookEvent(undefined)).toBe(false);
		expect(isWebhookEvent(null)).toBe(false);
		expect(isWebhookEvent(42)).toBe(false);
		expect(isWebhookEvent(["content.published"])).toBe(false);
		expect(isWebhookEvent({ event: "content.published" })).toBe(false);
	});
});

describe("validateWebhookCreateInput — URL", () => {
	it("rejects a missing url", () => {
		const result = validateWebhookCreateInput({ url: undefined, events: ["content.published"] });
		expect(result).toEqual({ ok: false, error: "Webhook URL is required." });
	});

	it("rejects an empty / whitespace-only url", () => {
		expect(validateWebhookCreateInput({ url: "", events: ["content.published"] }).ok).toBe(false);
		expect(validateWebhookCreateInput({ url: "   ", events: ["content.published"] }).ok).toBe(
			false,
		);
	});

	it("rejects a non-string url", () => {
		const result = validateWebhookCreateInput({ url: 123, events: ["content.published"] });
		expect(result).toEqual({ ok: false, error: "Webhook URL is required." });
	});

	it("rejects URLs that are not http(s)", () => {
		for (const url of [
			"ftp://example.com/hook",
			"javascript:alert(1)",
			"file:///etc/passwd",
			"example.com/hook",
			"//example.com/hook",
		]) {
			const result = validateWebhookCreateInput({ url, events: ["content.published"] });
			expect(result).toEqual({
				ok: false,
				error: "URL must start with http:// or https://",
			});
		}
	});

	it("accepts http and https URLs and trims surrounding whitespace", () => {
		const result = validateWebhookCreateInput({
			url: "  https://example.com/hook  ",
			events: ["content.published"],
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.url).toBe("https://example.com/hook");

		expect(
			validateWebhookCreateInput({ url: "http://example.com", events: ["media.deleted"] }).ok,
		).toBe(true);
	});
});

describe("validateWebhookCreateInput — events", () => {
	it("rejects a missing or non-array events field", () => {
		expect(validateWebhookCreateInput({ url: "https://example.com", events: undefined })).toEqual({
			ok: false,
			error: "At least one event is required.",
		});
		expect(
			validateWebhookCreateInput({ url: "https://example.com", events: "content.published" }),
		).toEqual({ ok: false, error: "At least one event is required." });
	});

	it("rejects an empty events array", () => {
		expect(validateWebhookCreateInput({ url: "https://example.com", events: [] })).toEqual({
			ok: false,
			error: "At least one event is required.",
		});
	});

	it("rejects an unsupported event name rather than silently dropping it", () => {
		const result = validateWebhookCreateInput({
			url: "https://example.com",
			events: ["content.published", "content.created"],
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("not supported");
			// The supported list is surfaced, comma-separated; the rejected
			// (attacker-controlled) string is never echoed back.
			expect(result.error).toContain("content.published, content.updated");
			expect(result.error).not.toContain("content.created");
		}
	});

	it("rejects when every event is unsupported", () => {
		const result = validateWebhookCreateInput({
			url: "https://example.com",
			events: ["bogus.event"],
		});
		expect(result.ok).toBe(false);
	});

	it("accepts the full canonical event set", () => {
		const result = validateWebhookCreateInput({
			url: "https://example.com/hook",
			events: [...WEBHOOK_EVENTS],
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.events).toEqual([...WEBHOOK_EVENTS]);
	});
});

// Parity proof: the admin form action (pages/ap-admin/actions/webhook-create)
// must reject exactly what the REST API rejects, because both now delegate to
// the shared validator above. The REST side is covered in api-endpoints.test.ts.
describe("POST /ap-admin/actions/webhook-create — validation parity", () => {
	function actionRequest(fields: { url?: string; events?: string[] }): Request {
		const fd = new FormData();
		if (fields.url !== undefined) fd.set("url", fields.url);
		for (const event of fields.events ?? []) fd.append("events", event);
		return new Request("https://example.com/ap-admin/actions/webhook-create", {
			method: "POST",
			body: fd,
		});
	}

	function callAction(fields: { url?: string; events?: string[] }) {
		return webhookCreatePOST({
			request: actionRequest(fields),
		} as Parameters<typeof webhookCreatePOST>[0]);
	}

	function errorMessage(res: Response): string | null {
		const location = res.headers.get("location") ?? "";
		const query = location.split("?")[1] ?? "";
		return new URLSearchParams(query).get("error");
	}

	beforeEach(() => {
		mockCreate.mockReset();
		mockCreate.mockResolvedValue({
			record: { id: "wh-1" },
			verification: { algorithm: "ML-DSA-65", publicKey: "k" },
		});
	});

	it("rejects a non-http(s) url and does not persist", async () => {
		const res = await callAction({ url: "ftp://example.com/hook", events: ["content.published"] });
		expect(errorMessage(res)).toBe("URL must start with http:// or https://");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("rejects an unsupported event name and does not persist", async () => {
		const res = await callAction({
			url: "https://example.com/hook",
			events: ["content.published", "content.created"],
		});
		expect(errorMessage(res)).toContain("not supported");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("rejects when no events are selected and does not persist", async () => {
		const res = await callAction({ url: "https://example.com/hook", events: [] });
		expect(errorMessage(res)).toBe("At least one event is required.");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("creates and stashes the one-time verification metadata in the flash store", async () => {
		const res = await callAction({
			url: "https://example.com/hook",
			events: ["content.published", "media.uploaded"],
		});
		expect(mockCreate).toHaveBeenCalledWith({
			url: "https://example.com/hook",
			events: ["content.published", "media.uploaded"],
		});
		// #115: the signing algorithm + public key are one-time material and must
		// NOT ride in the redirect URL. They go into the flash store; the URL
		// carries only the opaque flash id, consumed once on the next page load.
		const flashPayload = JSON.parse(mockFlashPut.mock.calls[0]?.[0] as string);
		expect(flashPayload).toEqual({ algorithm: "ML-DSA-65", publicKey: "k" });
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("created=1");
		expect(location).toContain("flash=flash-test-id");
		expect(location).not.toContain("algorithm=");
		expect(location).not.toContain("publicKey=");
	});
});
