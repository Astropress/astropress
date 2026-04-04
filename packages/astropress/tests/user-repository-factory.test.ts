import { describe, expect, it, vi } from "vitest";
import { createAstropressUserRepository } from "../src/user-repository-factory";

describe("user repository factory", () => {
  it("invites and suspends admin users through package-owned repository assembly", () => {
    const recordUserAudit = vi.fn();
    const repository = createAstropressUserRepository({
      listAdminUsers: vi.fn(() => []),
      hashPassword: vi.fn(() => "hashed-password"),
      hashOpaqueToken: vi.fn(() => "hashed-token"),
      findAdminUserByEmail: vi.fn(() => null),
      createInvitedAdminUser: vi.fn(() => true),
      getAdminUserIdByEmail: vi.fn(() => 42),
      insertUserInvite: vi.fn(() => true),
      setAdminUserActiveState: vi.fn(() => true),
      revokeAdminSessionsForEmail: vi.fn(),
      recordUserAudit,
    });

    const invited = repository.inviteAdminUser(
      {
        name: "Editor",
        email: "editor@example.com",
        role: "editor",
      },
      { email: "admin@example.com", role: "admin", name: "Admin" },
    );

    expect(invited.ok).toBe(true);

    expect(
      repository.suspendAdminUser("editor@example.com", {
        email: "admin@example.com",
        role: "admin",
        name: "Admin",
      }),
    ).toEqual({ ok: true });

    expect(
      repository.unsuspendAdminUser("editor@example.com", {
        email: "admin@example.com",
        role: "admin",
        name: "Admin",
      }),
    ).toEqual({ ok: true });

    expect(recordUserAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.restore",
        targetId: "editor@example.com",
      }),
    );
  });
});
