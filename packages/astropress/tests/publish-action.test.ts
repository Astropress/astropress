import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withAdminFormAction: vi.fn(),
  actionRedirect: vi.fn(),
  actionErrorRedirect: vi.fn(),
  resolveDeployHookFromEnv: vi.fn(),
  triggerPublish: vi.fn(),
}));

vi.mock("@astropress-diy/astropress", () => ({
  withAdminFormAction: mocks.withAdminFormAction,
  actionRedirect: mocks.actionRedirect,
  actionErrorRedirect: mocks.actionErrorRedirect,
}));

vi.mock("../src/admin-action-publish.js", () => ({
  resolveDeployHookFromEnv: mocks.resolveDeployHookFromEnv,
  triggerPublish: mocks.triggerPublish,
}));

describe("publish action", () => {
  it("requires an admin session and redirects back to the dashboard on success", async () => {
    const { POST } = await import("../pages/ap-admin/actions/publish.ts");

    mocks.withAdminFormAction.mockImplementation(
      async (_context: unknown, options: Record<string, unknown>, run: (action: Record<string, unknown>) => Promise<Response>) => {
        expect(options).toEqual({ failurePath: "/ap-admin", requireAdmin: true });
        return run({
          formData: new FormData(),
          locals: {} as App.Locals,
          request: new Request("https://example.com/ap-admin/actions/publish", { method: "POST" }),
          redirect: mocks.actionRedirect,
          fail: mocks.actionErrorRedirect,
          actor: { email: "admin@example.com", role: "admin", name: "Admin User" },
          sessionUser: { email: "admin@example.com", role: "admin", name: "Admin User" },
        });
      },
    );

    mocks.resolveDeployHookFromEnv.mockReturnValue({ type: "github-actions", env: {} });
    mocks.triggerPublish.mockResolvedValue({ ok: true, statusUrl: "https://example.com/status/123" });
    mocks.actionRedirect.mockImplementation(
      (location: string, status = 302) => new Response(null, { status, headers: { Location: location } }),
    );

    const response = await POST({} as never);

    expect(mocks.withAdminFormAction).toHaveBeenCalledTimes(1);
    expect(mocks.resolveDeployHookFromEnv).toHaveBeenCalledTimes(1);
    expect(mocks.triggerPublish).toHaveBeenCalledWith({ type: "github-actions", env: {} });
    expect(mocks.actionRedirect).toHaveBeenCalledWith("/ap-admin?saved=1");
    expect(response.headers.get("Location")).toBe("/ap-admin?saved=1");
  });
});
