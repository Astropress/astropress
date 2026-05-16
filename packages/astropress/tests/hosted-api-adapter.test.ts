import { describe, expect, it, vi } from "vitest";
import { createAstropressHostedApiAdapter } from "../src/hosted-api-adapter.js";

describe("hosted api adapter", () => {
	it("uses a remote JSON API surface for hosted providers", async () => {
		const requests: Array<{
			url: string;
			method: string;
			body?: string | null;
			auth?: string | null;
		}> = [];
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
						JSON.stringify([
							{
								id: "1",
								kind: "post",
								slug: "hello",
								status: "published",
								title: "Hello",
							},
						]),
						{ status: 200 },
					);
				}
				if (url.endsWith("/content/1")) {
					return new Response(
						JSON.stringify({
							id: "1",
							kind: "post",
							slug: "hello",
							status: "published",
							title: "Hello",
						}),
						{ status: 200 },
					);
				}
				if (url.endsWith("/content") && init?.method === "POST") {
					return new Response(String(init?.body), { status: 200 });
				}
				if (url.includes("/revisions?recordId=1")) {
					return new Response(
						JSON.stringify([{ id: "r1", recordId: "1", createdAt: "now", snapshot: {} }]),
						{
							status: 200,
						},
					);
				}
				if (url.endsWith("/auth/sign-in")) {
					return new Response(
						JSON.stringify({
							id: "session-1",
							email: "admin@example.com",
							role: "admin",
						}),
						{
							status: 200,
						},
					);
				}
				if (url.endsWith("/auth/session/session-1")) {
					return new Response(
						JSON.stringify({
							id: "session-1",
							email: "admin@example.com",
							role: "admin",
						}),
						{
							status: 200,
						},
					);
				}
				if (url.endsWith("/auth/sign-out")) {
					return new Response(JSON.stringify({ ok: true }), { status: 200 });
				}
				if (url.endsWith("/media") && init?.method === "POST") {
					return new Response(String(init?.body), { status: 200 });
				}
				if (url.endsWith("/media/logo")) {
					return new Response(
						JSON.stringify({
							id: "logo",
							filename: "logo.png",
							mimeType: "image/png",
						}),
						{
							status: 200,
						},
					);
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
		expect(
			(
				await adapter.content.save({
					id: "1",
					kind: "post",
					slug: "hello",
					status: "published",
					title: "Hello",
				})
			).title,
		).toBe("Hello");
		expect(
			(
				await adapter.media.put({
					id: "logo",
					filename: "logo.png",
					mimeType: "image/png",
				})
			).filename,
		).toBe("logo.png");
		expect((await adapter.revisions.list("1")).length).toBe(1);
		expect((await adapter.auth.signIn("admin@example.com", "password"))?.role).toBe("admin");
		expect((await adapter.auth.getSession("session-1"))?.email).toBe("admin@example.com");
		await adapter.auth.signOut("session-1");
		expect((await adapter.preview?.create({ recordId: "1" }))?.url).toContain("/preview/1");
		expect((await adapter.media.get("logo"))?.filename).toBe("logo.png");
		await adapter.media.delete("logo");
		const revision = {
			id: "r2",
			recordId: "1",
			createdAt: "now",
			snapshot: {},
		};
		await adapter.revisions.append(revision as Parameters<typeof adapter.revisions.append>[0]);
		await adapter.content.delete("1");

		expect(requests.every((request) => request.auth === "Bearer secret-token")).toBe(true);
	});

	it("throws when the API returns a non-OK HTTP response", async () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test/astropress",
			fetchImpl: async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
		});
		await expect(adapter.content.list()).rejects.toThrow(
			"Astropress hosted API request failed with 404",
		);
	});

	it("constructs URLs by trim-joining baseUrl with the path (no double slashes, no missing slashes)", async () => {
		const seen: string[] = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			// Trailing slash on the base intentionally exercises stripTrailingSlashes
			apiBaseUrl: "https://api.example.test/astropress/",
			fetchImpl: async (input) => {
				seen.push(String(input));
				return new Response(JSON.stringify([]), { status: 200 });
			},
		});
		await adapter.content.list();
		await adapter.content.list("post");
		await adapter.content.get("hello world");
		expect(seen[0]).toBe("https://api.example.test/astropress/content");
		expect(seen[1]).toBe("https://api.example.test/astropress/content?kind=post");
		// URL-encodes the id segment
		expect(seen[2]).toBe("https://api.example.test/astropress/content/hello%20world");
	});

	it("omits the authorization header when no accessToken is configured", async () => {
		const captured: Array<{ url: string; auth: string | null }> = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async (input, init) => {
				const headers = init?.headers as Record<string, string> | undefined;
				captured.push({ url: String(input), auth: headers?.authorization ?? null });
				return new Response(JSON.stringify([]), { status: 200 });
			},
		});
		await adapter.content.list();
		expect(captured[0].auth).toBeNull();
	});

	it("sets content-type: application/json on every outgoing request", async () => {
		const captured: Record<string, string>[] = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async (_url, init) => {
				captured.push(init?.headers as Record<string, string>);
				return new Response(JSON.stringify([]), { status: 200 });
			},
		});
		await adapter.content.list();
		expect(captured[0]["content-type"]).toBe("application/json");
	});

	it("uses POST for content.save / media.put / revisions.append, DELETE for *.delete", async () => {
		const captured: Array<{ url: string; method: string }> = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async (input, init) => {
				captured.push({ url: String(input), method: init?.method ?? "GET" });
				return new Response("{}", { status: 200 });
			},
		});
		await adapter.content.save({
			id: "1",
			kind: "post",
			slug: "h",
			status: "published",
			title: "T",
		});
		await adapter.media.put({ id: "m", filename: "f.png", mimeType: "image/png" });
		await adapter.revisions.append({
			id: "r",
			recordId: "1",
			createdAt: "now",
			snapshot: {},
		} as Parameters<typeof adapter.revisions.append>[0]);
		await adapter.content.delete("1");
		await adapter.media.delete("m");
		await adapter.auth.signOut("s");
		expect(captured[0].method).toBe("POST");
		expect(captured[0].url).toBe("https://api.example.test/content");
		expect(captured[1].method).toBe("POST");
		expect(captured[1].url).toBe("https://api.example.test/media");
		expect(captured[2].method).toBe("POST");
		expect(captured[2].url).toBe("https://api.example.test/revisions");
		expect(captured[3].method).toBe("DELETE");
		expect(captured[3].url).toBe("https://api.example.test/content/1");
		expect(captured[4].method).toBe("DELETE");
		expect(captured[4].url).toBe("https://api.example.test/media/m");
		expect(captured[5].method).toBe("POST");
		expect(captured[5].url).toBe("https://api.example.test/auth/sign-out");
	});

	it("auth.signIn sends {email, password} JSON body and auth.getSession URL-encodes the session id", async () => {
		const captured: Array<{ url: string; body: string | null }> = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async (input, init) => {
				captured.push({
					url: String(input),
					body: typeof init?.body === "string" ? init.body : null,
				});
				return new Response("null", { status: 200 });
			},
		});
		await adapter.auth.signIn("u@x.com", "pw");
		expect(captured[0].url).toBe("https://api.example.test/auth/sign-in");
		expect(JSON.parse(captured[0].body ?? "")).toEqual({ email: "u@x.com", password: "pw" });

		await adapter.auth.getSession("sess id 1");
		expect(captured[1].url).toBe("https://api.example.test/auth/session/sess%20id%201");
	});

	it("preview.create joins the preview base URL (not the api base) and URL-encodes recordId", async () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			previewBaseUrl: "https://preview.example.test/p",
			fetchImpl: async () => new Response("[]", { status: 200 }),
		});
		const preview = await adapter.preview?.create({ recordId: "post id 1", expiresAt: "later" });
		expect(preview?.url).toBe("https://preview.example.test/p/preview/post%20id%201");
		expect(preview?.expiresAt).toBe("later");
	});

	it("omits the preview store entirely when previewBaseUrl is not configured", () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async () => new Response("[]", { status: 200 }),
		});
		expect(adapter.preview).toBeUndefined();
	});

	it("propagates the provider name through capabilities", () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "appwrite",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async () => new Response("[]", { status: 200 }),
		});
		expect(adapter.capabilities.name).toBe("appwrite");
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	// Pin every default-true capability boolean literal so the
	// BooleanLiteral → false mutants at L53-58 of hosted-api-adapter.ts get
	// killed (one mutant per `true` in the normalizeProviderCapabilities
	// argument literal).
	it("defaults every hosted-runtime capability to true when no override is provided", () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "appwrite",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async () => new Response("[]", { status: 200 }),
		});
		expect(adapter.capabilities.hostedAdmin).toBe(true);
		expect(adapter.capabilities.previewEnvironments).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.gitSync).toBe(true);
	});

	// Pin the joinApiUrl path-segment separator (L29 StringLiteral mutant).
	// A mutated `/` between baseUrl and path would emit a URL like
	// "...example.testStryker was here!content" which would fail every
	// upstream request — but tests stub fetch, so only an assertion on
	// the URL passed to fetch can detect the mutant.
	it("constructs API URLs by joining baseUrl + path with a literal '/' separator", async () => {
		const captured: string[] = [];
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			fetchImpl: async (url) => {
				captured.push(String(url));
				return new Response("[]", { status: 200 });
			},
		});
		await adapter.content.list();
		expect(captured[0]).toBe("https://api.example.test/content");
	});

	it("allows defaultCapabilities overrides to flip a default true to false", () => {
		const adapter = createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: "https://api.example.test",
			defaultCapabilities: { gitSync: false },
			fetchImpl: async () => new Response("[]", { status: 200 }),
		});
		expect(adapter.capabilities.gitSync).toBe(false);
		// Other defaults remain true
		expect(adapter.capabilities.hostedAdmin).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
	});

	it("uses the global fetch when no fetchImpl override is supplied", async () => {
		const realFetch = globalThis.fetch;
		const stub = vi.fn(async () => new Response("[]", { status: 200 }));
		globalThis.fetch = stub as unknown as typeof fetch;
		try {
			const adapter = createAstropressHostedApiAdapter({
				providerName: "supabase",
				apiBaseUrl: "https://api.example.test",
			});
			await adapter.content.list();
			expect(stub).toHaveBeenCalledOnce();
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});
