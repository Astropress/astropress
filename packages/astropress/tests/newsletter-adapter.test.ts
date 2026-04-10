import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newsletterAdapter, placeholderAdapter } from "../src/newsletter-adapter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocalsWithMode(mode: string) {
  return {
    runtime: {
      env: {
        NEWSLETTER_DELIVERY_MODE: mode,
        MAILCHIMP_API_KEY: "test-api-key-us1",
        MAILCHIMP_LIST_ID: "list123",
        MAILCHIMP_SERVER: "us1",
      },
    },
  } as unknown as App.Locals;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("newsletterAdapter.subscribe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok in mock delivery mode without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mock"));
    expect(result).toMatchObject({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok when no locals are provided (defaults to mock in non-production)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await newsletterAdapter.subscribe("user@example.com", null);
    expect(result).toBeDefined();
    // In test env, PROD is not set, so it defaults to mock
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns error when mailchimp config is incomplete", async () => {
    const incompleteLocals = {
      runtime: {
        env: {
          NEWSLETTER_DELIVERY_MODE: "mailchimp",
          // Missing MAILCHIMP_API_KEY, LIST_ID, SERVER
        },
      },
    } as unknown as App.Locals;
    const result = await newsletterAdapter.subscribe("user@example.com", incompleteLocals);
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toBeTruthy();
  });

  it("calls the mailchimp API and returns ok on 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", { status: 200 }),
    );
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mailchimp"));
    expect(result).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns error on non-200 mailchimp response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Member Exists" }), { status: 400 }),
    );
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mailchimp"));
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toContain("Member Exists");
  });

  it("returns network error when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mailchimp"));
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toContain("Network error");
  });

  it("returns fallback error message when response has no detail field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 400 }),
    );
    const result = await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mailchimp"));
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toContain("Failed to subscribe");
  });

  it("calls the Listmonk subscribers API and returns ok on 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", { status: 200 }),
    );
    const listmonkLocals = {
      runtime: {
        env: {
          NEWSLETTER_DELIVERY_MODE: "listmonk",
          LISTMONK_API_URL: "https://listmonk.example.com",
          LISTMONK_API_USERNAME: "admin",
          LISTMONK_API_PASSWORD: "secret",
          LISTMONK_LIST_ID: "1",
        },
      },
    } as unknown as App.Locals;
    const result = await newsletterAdapter.subscribe("user@example.com", listmonkLocals);
    expect(result).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/subscribers");
  });

  it("returns error when listmonk config is incomplete", async () => {
    const incompleteLocals = {
      runtime: { env: { NEWSLETTER_DELIVERY_MODE: "listmonk" } },
    } as unknown as App.Locals;
    const result = await newsletterAdapter.subscribe("user@example.com", incompleteLocals);
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toBeTruthy();
  });

  it("placeholderAdapter is the same object as newsletterAdapter", () => {
    expect(placeholderAdapter).toBe(newsletterAdapter);
  });

  it("uses Base64 basic auth header for mailchimp request", async () => {
    let capturedAuth = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url, init) => {
      capturedAuth = (init?.headers as Record<string, string>)["Authorization"] ?? "";
      return new Response("{}", { status: 200 });
    });
    await newsletterAdapter.subscribe("user@example.com", makeLocalsWithMode("mailchimp"));
    // Basic auth = btoa("anystring:test-api-key-us1")
    expect(capturedAuth).toMatch(/^Basic /);
    const decoded = atob(capturedAuth.replace("Basic ", ""));
    expect(decoded).toBe("anystring:test-api-key-us1");
  });
});
