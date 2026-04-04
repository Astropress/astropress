import { describe, expect, it, vi } from "vitest";
import { createAstropressRedirectRepository } from "../src/redirect-repository-factory";

describe("redirect repository factory", () => {
  it("creates and deletes redirects through package-owned repository assembly", () => {
    const upsertRedirect = vi.fn();
    const markRedirectDeleted = vi.fn(() => true);
    const recordRedirectAudit = vi.fn();

    const repository = createAstropressRedirectRepository({
      getRedirectRules: vi.fn(() => []),
      normalizePath(path) {
        return path.startsWith("/") ? path : `/${path}`;
      },
      getExistingRedirect: vi.fn(() => null),
      upsertRedirect,
      markRedirectDeleted,
      recordRedirectAudit,
    });

    const created = repository.createRedirectRule(
      {
        sourcePath: "legacy",
        targetPath: "/next",
        statusCode: 302,
      },
      { email: "admin@example.com", role: "admin", name: "Admin" },
    );

    expect(created).toEqual({
      ok: true,
      rule: { sourcePath: "/legacy", targetPath: "/next", statusCode: 302 },
    });
    expect(upsertRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: "/legacy",
        targetPath: "/next",
        statusCode: 302,
      }),
    );

    const deleted = repository.deleteRedirectRule("legacy", {
      email: "admin@example.com",
      role: "admin",
      name: "Admin",
    });

    expect(deleted).toEqual({ ok: true });
    expect(markRedirectDeleted).toHaveBeenCalledWith("/legacy");
    expect(recordRedirectAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "redirect.delete",
        targetId: "/legacy",
      }),
    );
  });
});
