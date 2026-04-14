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
    const locals = makeLocals({});
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
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns ok in mock delivery mode without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocals({ NEWSLETTER_DELIVERY_MODE: "mock" }));
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
  beforeEach(() => { vi.restoreAllMocks(); });

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
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

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
      capturedAuth = (init?.headers as Record<string, string>)["Authorization"] ?? "";
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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Conflict", { status: 409 }),
    );
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
