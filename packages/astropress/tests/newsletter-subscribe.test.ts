import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the newsletter adapter before importing the endpoint
vi.mock("../src/newsletter-adapter.js", () => ({
  newsletterAdapter: {
    subscribe: vi.fn(),
  },
}));

import { newsletterAdapter } from "../src/newsletter-adapter.js";
import { POST } from "../pages/ap/newsletter/subscribe.js";

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
  });

  it("returns 200 ok for a valid JSON email", async () => {
    const res = await POST({ request: jsonRequest({ email: "user@example.com" }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true });
    expect(mockSubscribe).toHaveBeenCalledWith("user@example.com", MOCK_LOCALS);
  });

  it("returns 200 ok for a valid form-encoded email", async () => {
    const res = await POST({ request: formRequest("editor@site.com"), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true });
    expect(mockSubscribe).toHaveBeenCalledWith("editor@site.com", MOCK_LOCALS);
  });

  it("returns 400 for missing email", async () => {
    const res = await POST({ request: jsonRequest({}), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false });
    expect(typeof body.error).toBe("string");
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST({ request: jsonRequest({ email: "not-an-email" }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
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
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false });
  });

  it("returns 422 when the adapter returns an error", async () => {
    mockSubscribe.mockResolvedValueOnce({ ok: false, error: "Listmonk server unreachable." });
    const res = await POST({ request: jsonRequest({ email: "user@example.com" }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false, error: "Listmonk server unreachable." });
  });

  it("returns 422 with fallback message when adapter error has no message", async () => {
    mockSubscribe.mockResolvedValueOnce({ ok: false });
    const res = await POST({ request: jsonRequest({ email: "user@example.com" }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false });
    expect(typeof body.error).toBe("string");
  });

  it("trims whitespace from email before validation", async () => {
    const res = await POST({ request: jsonRequest({ email: "  user@example.com  " }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(mockSubscribe).toHaveBeenCalledWith("user@example.com", MOCK_LOCALS);
  });

  it("returns Content-Type: application/json on all responses", async () => {
    const res = await POST({ request: jsonRequest({ email: "bad" }), locals: MOCK_LOCALS } as Parameters<typeof POST>[0]);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
