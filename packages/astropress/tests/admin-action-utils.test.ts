import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeCsrfToken: vi.fn(),
  getRuntimeSessionUser: vi.fn(),
}));

vi.mock("../src/runtime-admin-auth", () => ({
  getRuntimeCsrfToken: mocks.getRuntimeCsrfToken,
  getRuntimeSessionUser: mocks.getRuntimeSessionUser,
}));

function makeContext(
  form: Record<string, string> = {},
  options: { url?: string; origin?: string | null; referer?: string | null } = {},
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
    request: {
      url: options.url ?? "https://example.com/ap-admin/actions/content-save",
      headers,
      formData: vi.fn(async () => {
        const fd = new FormData();
        for (const [key, value] of Object.entries(form)) {
          fd.set(key, value);
        }
        return fd;
      }),
    } as unknown as Request,
  } as never;
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
  });

  it("redirects unauthenticated requests to login", async () => {
    mocks.getRuntimeSessionUser.mockResolvedValue(null);
    const { requireAdminFormAction } = await import("astropress");

    const result = await requireAdminFormAction(makeContext({ _csrf: "csrf-token" }), {
      failurePath: "/ap-admin/posts",
    });

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
    const { requireAdminFormAction } = await import("astropress");

    const result = await requireAdminFormAction(makeContext({ _csrf: "csrf-token" }), {
      failurePath: "/ap-admin/users",
      requireAdmin: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.headers.get("Location")).toContain("/ap-admin/users?error=1");
    }
  });

  it("rejects invalid csrf tokens with a safe redirect", async () => {
    const { requireAdminFormAction } = await import("astropress");

    const result = await requireAdminFormAction(makeContext({ _csrf: "wrong" }), {
      failurePath: "/ap-admin/posts/new",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.headers.get("Location")).toBe("/ap-admin/posts/new?error=1&message=Invalid+security+token");
    }
  });

  it("rejects cross-origin admin form posts", async () => {
    const { requireAdminFormAction } = await import("astropress");

    const result = await requireAdminFormAction(
      makeContext({ _csrf: "csrf-token" }, { origin: "https://evil.example" }),
      { failurePath: "/ap-admin/posts/new" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.headers.get("Location")).toBe("/ap-admin/posts/new?error=1&message=Invalid+request+origin");
    }
  });

  it("wraps unexpected handler failures in a safe redirect", async () => {
    const { withAdminFormAction } = await import("astropress");

    const response = await withAdminFormAction(
      makeContext({ _csrf: "csrf-token" }),
      { failurePath: "/ap-admin/posts/new" },
      async () => {
        throw new Error("boom");
      },
    );

    expect(response.headers.get("Location")).toBe("/ap-admin/posts/new?error=1&message=Something+went+wrong.+Please+try+again.");
  });

  it("passes actor and form data into successful handlers", async () => {
    const { withAdminFormAction } = await import("astropress");

    const response = await withAdminFormAction(
      makeContext({ _csrf: "csrf-token", slug: "hello-world" }),
      { failurePath: "/ap-admin/posts/new" },
      async ({ actor, formData, redirect }) => {
        expect(actor.email).toBe("admin@example.com");
        expect(String(formData.get("slug"))).toBe("hello-world");
        return redirect("/ap-admin/posts/hello-world?created=1");
      },
    );

    expect(response.headers.get("Location")).toBe("/ap-admin/posts/hello-world?created=1");
  });

  it("builds error redirects with encoded messages", async () => {
    const { actionErrorRedirect } = await import("astropress");
    const response = actionErrorRedirect("/ap-admin/settings", "Bad input");
    expect(response.headers.get("Location")).toBe("/ap-admin/settings?error=1&message=Bad+input");
  });
});
