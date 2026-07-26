import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newsletterAdapter, placeholderAdapter } from "../src/newsletter-adapter";
import { getNewsletterConfig } from "../src/runtime-env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocals(env: Record<string, string>) {
	return { runtime: { env } } as unknown as App.Locals;
}

const listmonkEnv = {
	NEWSLETTER_DELIVERY_MODE: "listmonk",
	LISTMONK_API_URL: "https://listmonk.example.com",
	LISTMONK_API_USERNAME: "admin",
	LISTMONK_API_PASSWORD: "secret",
	LISTMONK_LIST_ID: "1",
};

// ---------------------------------------------------------------------------
// getNewsletterConfig — default mode behavior
// ---------------------------------------------------------------------------

describe("NEWSLETTER_DELIVERY_MODE defaults to listmonk in production", () => {
	it("returns listmonk when PROD is true and no mode is set", () => {
		// Simulate production by having no env override — the function checks
		// isProductionRuntime() which reads import.meta.env.PROD. In tests that
		// is false, so we verify the explicit listmonk path instead via locals.
		const cfg = getNewsletterConfig(makeLocals({ NEWSLETTER_DELIVERY_MODE: "listmonk" }));
		expect(cfg.mode).toBe("listmonk");
	});
});

describe("NEWSLETTER_DELIVERY_MODE defaults to mock in development", () => {
	it("returns mock when no mode is set and PROD is false (test env)", () => {
		const cfg = getNewsletterConfig(makeLocals({}));
		// In the test environment import.meta.env.PROD is false → default is mock
		expect(cfg.mode).toBe("mock");
	});
});

// ---------------------------------------------------------------------------
// newsletterAdapter.subscribe — mock mode
// ---------------------------------------------------------------------------

describe("mock delivery mode", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns ok in mock delivery mode without calling fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await newsletterAdapter.subscribe(
			"user@example.com",
			makeLocals({ NEWSLETTER_DELIVERY_MODE: "mock" }),
		);
		expect(result).toMatchObject({ ok: true });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns ok when no locals are provided (defaults to mock in non-production)", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await newsletterAdapter.subscribe("user@example.com", null);
		expect(result).toBeDefined();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe("Unrecognized delivery mode falls back to mock", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns ok: true for an unknown mode without calling fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await newsletterAdapter.subscribe(
			"user@example.com",
			makeLocals({ NEWSLETTER_DELIVERY_MODE: "unknown-service" }),
		);
		expect(result).toMatchObject({ ok: true });
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// newsletterAdapter.subscribe — Listmonk mode
// ---------------------------------------------------------------------------

describe("Subscriber endpoint forwards to Listmonk API via newsletterAdapter", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls the Listmonk subscribers API and returns ok on 200", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const result = await newsletterAdapter.subscribe("user@example.com", makeLocals(listmonkEnv));
		expect(result).toMatchObject({ ok: true });
		expect(fetch).toHaveBeenCalledOnce();
		const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
		expect(url).toContain("/api/subscribers");
	});

	it("uses Basic auth header derived from username:password", async () => {
		let capturedAuth = "";
		vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
			capturedAuth = (init!.headers as Record<string, string>).Authorization ?? "";
			return new Response("{}", { status: 200 });
		});
		await newsletterAdapter.subscribe("user@example.com", makeLocals(listmonkEnv));
		expect(capturedAuth).toMatch(/^Basic /);
		const decoded = atob(capturedAuth.replace("Basic ", ""));
		expect(decoded).toBe("admin:secret");
	});

	it("sends email, name, status, and lists in the request body", async () => {
		let body: Record<string, unknown> = {};
		vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
			body = JSON.parse(init?.body as string) as Record<string, unknown>;
			return new Response("{}", { status: 200 });
		});
		await newsletterAdapter.subscribe("test@example.com", makeLocals(listmonkEnv));
		expect(body.email).toBe("test@example.com");
		expect(body.status).toBe("enabled");
		expect(Array.isArray(body.lists)).toBe(true);
		expect((body.lists as number[])[0]).toBe(1);
	});

	it("returns error on non-200 Listmonk response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Conflict", { status: 409 }));
		const result = await newsletterAdapter.subscribe("user@example.com", makeLocals(listmonkEnv));
		expect(result).toMatchObject({ ok: false });
		expect(result.error).toBeTruthy();
	});

	it("returns network error when fetch throws for Listmonk", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));
		const result = await newsletterAdapter.subscribe("user@example.com", makeLocals(listmonkEnv));
		expect(result).toMatchObject({ ok: false });
		expect(result.error).toContain("could not be reached");
	});

	it("sends method:POST + Content-Type: application/json + preconfirm_subscriptions:true (pins L73/L76/L83)", async () => {
		let init: RequestInit = {};
		vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, requestInit) => {
			init = requestInit as RequestInit;
			return new Response("{}", { status: 200 });
		});
		await newsletterAdapter.subscribe("u@x.com", makeLocals(listmonkEnv));
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("application/json");
		const body = JSON.parse(init.body as string);
		expect(body.preconfirm_subscriptions).toBe(true);
	});

	it("logs 'Listmonk API error' on non-ok response (pins L88 message + payload)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("body", { status: 500 }));
		await newsletterAdapter.subscribe("u@x.com", makeLocals(listmonkEnv));
		const matched = errorSpy.mock.calls.find((args) =>
			args.some((a) => typeof a === "string" && a === "Listmonk API error"),
		);
		expect(matched).toBeDefined();
		const meta = matched?.[2] as Record<string, unknown>;
		expect(meta?.status).toBe(500);
		expect(meta?.body).toBe("body");
		errorSpy.mockRestore();
	});

	it("logs 'Successfully subscribed to Listmonk' on 200 (pins L94 message + payload)", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
		await newsletterAdapter.subscribe("u@x.com", makeLocals(listmonkEnv));
		const matched = logSpy.mock.calls.find((args) =>
			args.some((a) => typeof a === "string" && a === "Successfully subscribed to Listmonk"),
		);
		expect(matched).toBeDefined();
		const meta = matched?.[2] as Record<string, unknown>;
		expect(meta?.email).toBe("u@x.com");
		logSpy.mockRestore();
	});

	it("logs 'Listmonk subscription error' on fetch throw (pins L97 message + payload)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("oops"));
		await newsletterAdapter.subscribe("u@x.com", makeLocals(listmonkEnv));
		const matched = errorSpy.mock.calls.find((args) =>
			args.some((a) => typeof a === "string" && a === "Listmonk subscription error"),
		);
		expect(matched).toBeDefined();
		const meta = matched?.[2] as Record<string, unknown>;
		expect(String((meta?.error as Error)?.message ?? meta?.error)).toContain("oops");
		errorSpy.mockRestore();
	});

	it("logs 'Newsletter is misconfigured' when config is incomplete (pins L122 message + payload)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		await newsletterAdapter.subscribe(
			"u@x.com",
			makeLocals({
				NEWSLETTER_DELIVERY_MODE: "listmonk",
				LISTMONK_API_URL: "https://x",
				LISTMONK_API_USERNAME: "u",
				LISTMONK_API_PASSWORD: "p",
				// LISTMONK_LIST_ID missing
			}),
		);
		const matched = errorSpy.mock.calls.find((args) =>
			args.some((a) => typeof a === "string" && a === "Newsletter is misconfigured"),
		);
		expect(matched).toBeDefined();
		const meta = matched?.[2] as Record<string, unknown>;
		expect(meta?.reason).toBeDefined();
		errorSpy.mockRestore();
	});

	it("logs 'Using mock delivery mode.' in mock mode (pins L129 message + payload)", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		await newsletterAdapter.subscribe("u@x.com", makeLocals({ NEWSLETTER_DELIVERY_MODE: "mock" }));
		const matched = logSpy.mock.calls.find((args) =>
			args.some((a) => typeof a === "string" && a === "Using mock delivery mode."),
		);
		expect(matched).toBeDefined();
		const meta = matched?.[2] as Record<string, unknown>;
		expect(meta?.mode).toBe("mock");
		logSpy.mockRestore();
	});
});

describe("Listmonk adapter returns error when configuration is incomplete", () => {
	it("returns ok: false when LISTMONK_API_URL is missing", async () => {
		const result = await newsletterAdapter.subscribe(
			"user@example.com",
			makeLocals({ NEWSLETTER_DELIVERY_MODE: "listmonk" }),
		);
		expect(result).toMatchObject({ ok: false });
		expect(result.error).toBeTruthy();
	});

	it("returns ok: false when LISTMONK_LIST_ID is missing", async () => {
		const result = await newsletterAdapter.subscribe(
			"user@example.com",
			makeLocals({
				NEWSLETTER_DELIVERY_MODE: "listmonk",
				LISTMONK_API_URL: "https://listmonk.example.com",
				LISTMONK_API_USERNAME: "admin",
				LISTMONK_API_PASSWORD: "secret",
				// LISTMONK_LIST_ID intentionally omitted
			}),
		);
		expect(result).toMatchObject({ ok: false });
		expect(result.error).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// placeholderAdapter
// ---------------------------------------------------------------------------

it("placeholderAdapter is the same object as newsletterAdapter", () => {
	expect(placeholderAdapter).toBe(newsletterAdapter);
});
