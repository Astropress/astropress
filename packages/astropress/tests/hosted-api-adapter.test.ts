import { describe, expect, it } from "vitest";
import { createAstropressHostedApiAdapter } from "../src/hosted-api-adapter.js";

describe("hosted api adapter", () => {
  it("uses a remote JSON API surface for hosted providers", async () => {
    const requests: Array<{ url: string; method: string; body?: string | null; auth?: string | null }> = [];
    const adapter = createAstropressHostedApiAdapter({
      providerName: "supabase",
      apiBaseUrl: "https://api.example.test/astropress",
      accessToken: "secret-token",
      previewBaseUrl: "https://preview.example.test",
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? init.body : null,
          auth:
            init?.headers && typeof init.headers === "object" && "authorization" in init.headers
              ? String((init.headers as Record<string, string>).authorization)
              : null,
        });

        if (url.endsWith("/content?kind=post")) {
          return new Response(
            JSON.stringify([{ id: "1", kind: "post", slug: "hello", status: "published", title: "Hello" }]),
            { status: 200 },
          );
        }
        if (url.endsWith("/content/1")) {
          return new Response(
            JSON.stringify({ id: "1", kind: "post", slug: "hello", status: "published", title: "Hello" }),
            { status: 200 },
          );
        }
        if (url.endsWith("/content") && init?.method === "POST") {
          return new Response(String(init?.body), { status: 200 });
        }
        if (url.includes("/revisions?recordId=1")) {
          return new Response(JSON.stringify([{ id: "r1", recordId: "1", createdAt: "now", snapshot: {} }]), {
            status: 200,
          });
        }
        if (url.endsWith("/auth/sign-in")) {
          return new Response(JSON.stringify({ id: "session-1", email: "admin@example.com", role: "admin" }), {
            status: 200,
          });
        }
        if (url.endsWith("/auth/session/session-1")) {
          return new Response(JSON.stringify({ id: "session-1", email: "admin@example.com", role: "admin" }), {
            status: 200,
          });
        }
        if (url.endsWith("/auth/sign-out")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url.endsWith("/media") && init?.method === "POST") {
          return new Response(String(init?.body), { status: 200 });
        }
        if (url.endsWith("/media/logo")) {
          return new Response(JSON.stringify({ id: "logo", filename: "logo.png", mimeType: "image/png" }), {
            status: 200,
          });
        }
        if (url.endsWith("/revisions") && init?.method === "POST") {
          return new Response(String(init?.body), { status: 200 });
        }
        if (init?.method === "DELETE") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      },
    });

    expect((await adapter.content.list("post")).length).toBe(1);
    expect((await adapter.content.get("1"))?.slug).toBe("hello");
    expect((await adapter.content.save({
      id: "1",
      kind: "post",
      slug: "hello",
      status: "published",
      title: "Hello",
    })).title).toBe("Hello");
    expect((await adapter.media.put({ id: "logo", filename: "logo.png", mimeType: "image/png" })).filename).toBe(
      "logo.png",
    );
    expect((await adapter.revisions.list("1")).length).toBe(1);
    expect((await adapter.auth.signIn("admin@example.com", "password"))?.role).toBe("admin");
    expect((await adapter.auth.getSession("session-1"))?.email).toBe("admin@example.com");
    await adapter.auth.signOut("session-1");
    expect((await adapter.preview?.create({ recordId: "1" }))?.url).toContain("/preview/1");
    // Lines 70-71: media.get (missing from original test)
    expect((await adapter.media.get("logo"))?.filename).toBe("logo.png");
    // Lines 74-77: media.delete (missing from original test)
    await adapter.media.delete("logo");
    // Lines 84-88: revisions.append (missing from original test)
    const revision = { id: "r2", recordId: "1", createdAt: "now", snapshot: {} };
    await adapter.revisions.append(revision as Parameters<typeof adapter.revisions.append>[0]);
    // Lines 58-61: content.delete (missing from original test)
    await adapter.content.delete("1");

    expect(requests.every((request) => request.auth === "Bearer secret-token")).toBe(true);
  });

  it("throws when the API returns a non-OK response (lines 9-10 readJson error branch)", async () => {
    const adapter = createAstropressHostedApiAdapter({
      providerName: "supabase",
      apiBaseUrl: "https://api.example.test/astropress",
      fetchImpl: async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
    });
    await expect(adapter.content.list()).rejects.toThrow("Astropress hosted API request failed with 404");
  });
});
