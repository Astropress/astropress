import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFormRequest } from "./helpers/make-request.js";

const mocks = vi.hoisted(() => ({
	getRuntimeCsrfToken: vi.fn(),
	getRuntimeSessionUser: vi.fn(),
	getRuntimeEnv: vi.fn(),
}));

vi.mock("../src/runtime-admin-auth", () => ({
	getRuntimeCsrfToken: mocks.getRuntimeCsrfToken,
	getRuntimeSessionUser: mocks.getRuntimeSessionUser,
}));

vi.mock("../src/runtime-env", async () => {
	const actual =
		await vi.importActual<typeof import("../src/runtime-env")>(
			"../src/runtime-env",
		);
	return {
		...actual,
		getRuntimeEnv: mocks.getRuntimeEnv,
	};
});

vi.mock("../src/runtime-env.js", async () => {
	const actual =
		await vi.importActual<typeof import("../src/runtime-env")>(
			"../src/runtime-env",
		);
	return {
		...actual,
		getRuntimeEnv: mocks.getRuntimeEnv,
	};
});

function makeContext(
	form: Record<string, string> = {},
	options: {
		url?: string;
		origin?: string | null;
		referer?: string | null;
	} = {},
) {
	const headers = new Headers();
	if (options.origin !== undefined && options.origin !== null) {
		headers.set("origin", options.origin);
	}
	if (options.referer !== undefined && options.referer !== null) {
		headers.set("referer", options.referer);
	}

	return {
		cookies: {
			get: vi.fn(() => ({ value: "session-token" })),
		},
		locals: {} as App.Locals,
		// makeFormRequest builds a real Request with a real FormData body — no cast needed.
		request: makeFormRequest(form, { url: options.url, headers }),
	} as unknown as Parameters<
		typeof import("@astropress-diy/astropress")["requireAdminFormAction"]
	>[0];
}

describe("admin action utils", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.resetAllMocks();
		mocks.getRuntimeCsrfToken.mockResolvedValue("csrf-token");
		mocks.getRuntimeSessionUser.mockResolvedValue({
			email: "admin@example.com",
			role: "admin",
			name: "Admin User",
		});
		mocks.getRuntimeEnv.mockReturnValue(undefined);
	});

	afterAll(() => {
		vi.resetModules();
	});

	it("redirects unauthenticated requests to login", async () => {
		mocks.getRuntimeSessionUser.mockResolvedValue(null);
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);

		const result = await requireAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{
				failurePath: "/ap-admin/posts",
			},
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.headers.get("Location")).toBe("/ap-admin/login");
		}
	});

	it("redirects non-admin users away from admin-only actions", async () => {
		mocks.getRuntimeSessionUser.mockResolvedValue({
			email: "editor@example.com",
			role: "editor",
			name: "Editor User",
		});
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);

		const result = await requireAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{
				failurePath: "/ap-admin/users",
				requireAdmin: true,
			},
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.headers.get("Location")).toContain(
				"/ap-admin/users?error=1",
			);
		}
	});

	it("rejects invalid csrf tokens with a safe redirect", async () => {
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);

		const result = await requireAdminFormAction(
			makeContext({ _csrf: "wrong" }),
			{
				failurePath: "/ap-admin/posts/new",
			},
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.headers.get("Location")).toBe(
				"/ap-admin/posts/new?error=1&message=Invalid+security+token",
			);
		}
	});

	it("rejects cross-origin admin form posts", async () => {
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);

		const result = await requireAdminFormAction(
			makeContext({ _csrf: "csrf-token" }, { origin: "https://evil.example" }),
			{ failurePath: "/ap-admin/posts/new" },
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.headers.get("Location")).toBe(
				"/ap-admin/posts/new?error=1&message=Invalid+request+origin",
			);
		}
	});

	it("wraps unexpected handler failures in a safe redirect", async () => {
		const { withAdminFormAction } = await import("@astropress-diy/astropress");

		const response = await withAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{ failurePath: "/ap-admin/posts/new" },
			async () => {
				throw new Error("boom");
			},
		);

		expect(response.headers.get("Location")).toBe(
			"/ap-admin/posts/new?error=1&message=The+requested+change+could+not+be+completed.+Reload+the+page+and+retry+the+action.",
		);
	});

	it("accepts the current non-legacy session cookie name", async () => {
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		const context = makeContext({ _csrf: "csrf-token" });
		context.cookies.get = vi.fn((name: string) =>
			name === "astropress_admin_session"
				? { value: "session-token" }
				: undefined,
		);

		const result = await requireAdminFormAction(context, {
			failurePath: "/ap-admin/posts",
		});

		expect(result.ok).toBe(true);
	});

	it("accepts harness locals when PLAYWRIGHT_E2E_MODE is admin-harness", async () => {
		mocks.getRuntimeSessionUser.mockResolvedValue(null);
		mocks.getRuntimeCsrfToken.mockResolvedValue(null);
		mocks.getRuntimeEnv.mockImplementation((name: string) =>
			name === "PLAYWRIGHT_E2E_MODE" ? "admin-harness" : undefined,
		);
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		const context = makeContext({ _csrf: "harness-csrf-token" });
		context.locals = {
			adminUser: {
				email: "admin@example.com",
				role: "admin",
				name: "Admin Harness",
			},
			csrfToken: "harness-csrf-token",
		} as App.Locals;

		const result = await requireAdminFormAction(context, {
			failurePath: "/ap-admin/posts",
		});

		expect(result.ok).toBe(true);
	});

	it("passes actor and form data into successful handlers", async () => {
		const { withAdminFormAction } = await import("@astropress-diy/astropress");

		const response = await withAdminFormAction(
			makeContext({ _csrf: "csrf-token", slug: "hello-world" }),
			{ failurePath: "/ap-admin/posts/new" },
			async ({ actor, formData, redirect }) => {
				expect(actor.email).toBe("admin@example.com");
				expect(String(formData.get("slug"))).toBe("hello-world");
				return redirect("/ap-admin/posts/hello-world?created=1");
			},
		);

		expect(response.headers.get("Location")).toBe(
			"/ap-admin/posts/hello-world?created=1",
		);
	});

	it("builds error redirects with encoded messages", async () => {
		const { actionErrorRedirect } = await import("@astropress-diy/astropress");
		const response = actionErrorRedirect("/ap-admin/settings", "Bad input");
		expect(response.headers.get("Location")).toBe(
			"/ap-admin/settings?error=1&message=Bad+input",
		);
	});

	it("propagates guard non-ok response when auth check fails inside withAdminFormAction", async () => {
		mocks.getRuntimeSessionUser.mockResolvedValue(null);
		const { withAdminFormAction } = await import("@astropress-diy/astropress");

		const response = await withAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{ failurePath: "/ap-admin/posts" },
			async () => new Response("should not reach"),
		);

		expect(response.headers.get("Location")).toBe("/ap-admin/login");
	});

	it("fail() redirects to failurePath with encoded message", async () => {
		const { withAdminFormAction } = await import("@astropress-diy/astropress");

		const response = await withAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{ failurePath: "/ap-admin/posts/new" },
			async ({ fail }) => fail("Invalid title"),
		);

		expect(response.headers.get("Location")).toBe(
			"/ap-admin/posts/new?error=1&message=Invalid+title",
		);
	});

	it("fail() uses overridePath when provided", async () => {
		const { withAdminFormAction } = await import("@astropress-diy/astropress");

		const response = await withAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{ failurePath: "/ap-admin/posts/new" },
			async ({ fail }) => fail("Already exists", "/ap-admin/posts/existing"),
		);

		expect(response.headers.get("Location")).toBe(
			"/ap-admin/posts/existing?error=1&message=Already+exists",
		);
	});

	it("uses secure cookie name when PROD env is set", async () => {
		process.env.PROD = "true";
		try {
			const { requireAdminFormAction } = await import(
				"@astropress-diy/astropress"
			);
			const context = makeContext({ _csrf: "csrf-token" });
			context.cookies.get = vi.fn((name: string) =>
				name === "__Host-astropress_admin_session"
					? { value: "session-token" }
					: undefined,
			);
			const result = await requireAdminFormAction(context, {
				failurePath: "/ap-admin/posts",
			});
			expect(result.ok).toBe(true);
		} finally {
			process.env.PROD = undefined;
		}
	});

	it("falls back to legacy cookie when primary session cookie is absent", async () => {
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		const context = makeContext({ _csrf: "csrf-token" });
		// Return undefined for the primary cookie names, a value only for the legacy name
		context.cookies.get = vi.fn((name: string) =>
			name === "ff_admin_session" ? { value: "session-token" } : undefined,
		);
		const result = await requireAdminFormAction(context, {
			failurePath: "/ap-admin/posts",
		});
		expect(result.ok).toBe(true);
	});

	it("rejects when csrf token resolves to null and not in harness mode", async () => {
		mocks.getRuntimeCsrfToken.mockResolvedValue(null);
		mocks.getRuntimeEnv.mockReturnValue(undefined); // not harness mode
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		const result = await requireAdminFormAction(
			makeContext({ _csrf: "anything" }),
			{
				failurePath: "/ap-admin/posts",
			},
		);
		expect(result.ok).toBe(false);
	});

	it("rejects when in harness mode but csrfToken is absent from locals", async () => {
		mocks.getRuntimeCsrfToken.mockResolvedValue(null);
		mocks.getRuntimeEnv.mockImplementation((name: string) =>
			name === "PLAYWRIGHT_E2E_MODE" ? "admin-harness" : undefined,
		);
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		const context = makeContext({ _csrf: "any" });
		// locals has adminUser but no csrfToken — triggers csrfToken ?? null path
		context.locals = {
			adminUser: { email: "admin@example.com", role: "admin", name: "Admin" },
		} as App.Locals;
		const result = await requireAdminFormAction(context, {
			failurePath: "/ap-admin/posts",
		});
		expect(result.ok).toBe(false); // expectedToken = null → CSRF check fails
	});

	it("treats a missing _csrf form field as an empty string", async () => {
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);
		// Submit form with no _csrf field; empty string won't match "csrf-token"
		const result = await requireAdminFormAction(makeContext({}), {
			failurePath: "/ap-admin/posts",
		});
		expect(result.ok).toBe(false);
	});

	it("unknown option keys like requireRole do NOT enforce admin-only access (regression for #35)", async () => {
		// Simulates the old publish.ts bug: passing { requireRole: "admin" } instead of { requireAdmin: true }.
		// The guard must not silently ignore unknown keys — this test proves that only requireAdmin works.
		mocks.getRuntimeSessionUser.mockResolvedValue({
			email: "editor@example.com",
			role: "editor",
			name: "Editor User",
		});
		const { requireAdminFormAction } = await import(
			"@astropress-diy/astropress"
		);

		const result = await requireAdminFormAction(
			makeContext({ _csrf: "csrf-token" }),
			{
				failurePath: "/ap-admin",
				// @ts-expect-error — deliberately testing the wrong key to prove it doesn't guard
				requireRole: "admin",
			},
		);

		// Without requireAdmin: true, an editor session passes the guard — this is the bug.
		// The fix is in publish.ts (use requireAdmin: true), not here. This test documents the footgun.
		expect(result.ok).toBe(true);
	});
});
