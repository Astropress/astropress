import { describe, expect, it, vi } from "vitest";
import { createAstropressUserRepository } from "../src/user-repository-factory";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

function makeRepo(overrides: Partial<Parameters<typeof createAstropressUserRepository>[0]> = {}) {
	const defaults = {
		listAdminUsers: vi.fn(() => []),
		hashPassword: vi.fn(() => "hashed-password"),
		hashOpaqueToken: vi.fn(() => "hashed-token"),
		findAdminUserByEmail: vi.fn(() => null),
		createInvitedAdminUser: vi.fn(() => true),
		getAdminUserIdByEmail: vi.fn(() => 42),
		insertUserInvite: vi.fn(() => true),
		setAdminUserActiveState: vi.fn(() => true),
		revokeAdminSessionsForEmail: vi.fn(),
		recordUserAudit: vi.fn(),
	};
	const merged = { ...defaults, ...overrides };
	const repository = createAstropressUserRepository(merged);
	return { repository, ...merged };
}

describe("user repository factory — inviteAdminUser", () => {
	it("trims name, lower-cases email, creates the user, persists an invite, and returns the accept-invite URL", () => {
		const { repository, createInvitedAdminUser, insertUserInvite, recordUserAudit } = makeRepo();
		const result = repository.inviteAdminUser(
			{ name: "  Editor  ", email: "  Editor@Example.com  ", role: "editor" },
			actor,
		);
		expect(result.ok).toBe(true);
		if (result.ok === true) {
			expect(result.inviteUrl).toMatch(/^\/ap-admin\/accept-invite\?token=/);
		}
		expect(createInvitedAdminUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: "editor@example.com",
				role: "editor",
				name: "Editor",
				passwordHash: "hashed-password",
			}),
		);
		expect(insertUserInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 42,
				tokenHash: "hashed-token",
				invitedBy: actor.email,
			}),
		);
		const invite = insertUserInvite.mock.calls[0]?.[0] as { inviteId: string; expiresAt: string };
		expect(invite.inviteId).toMatch(/^invite-/);
		// expires ~7 days in the future
		const expiresMs = Date.parse(invite.expiresAt);
		expect(expiresMs).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
		expect(recordUserAudit).toHaveBeenCalledWith({
			actor,
			action: "user.invite",
			summary: "Invited editor@example.com as an editor user.",
			targetId: "editor@example.com",
		});
	});

	it("accepts role=admin (returns admin via the ternary's first arm)", () => {
		const { repository, createInvitedAdminUser } = makeRepo();
		const r = repository.inviteAdminUser(
			{ name: "Admin Two", email: "two@example.com", role: "admin" },
			actor,
		);
		expect(r.ok).toBe(true);
		expect(createInvitedAdminUser).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
	});

	it("rejects role that is neither admin nor editor with the joint-required error", () => {
		const { repository, createInvitedAdminUser } = makeRepo();
		const r = repository.inviteAdminUser(
			{ name: "X", email: "x@example.com", role: "viewer" as unknown as "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "Name, email, and role are required." });
		expect(createInvitedAdminUser).not.toHaveBeenCalled();
	});

	it("rejects when name trims to empty", () => {
		const { repository } = makeRepo();
		const r = repository.inviteAdminUser(
			{ name: "   ", email: "x@example.com", role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "Name, email, and role are required." });
	});

	it("rejects when email is malformed (regex fails)", () => {
		const { repository } = makeRepo();
		const r = repository.inviteAdminUser(
			{ name: "X", email: "not-an-email", role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "Enter a valid email address." });
	});

	it("rejects when email exceeds 254 characters", () => {
		const { repository } = makeRepo();
		const longLocal = "a".repeat(250);
		const r = repository.inviteAdminUser(
			{ name: "X", email: `${longLocal}@example.com`, role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "Enter a valid email address." });
	});

	it("rejects when an admin user with that email already exists", () => {
		const { repository, createInvitedAdminUser } = makeRepo({
			findAdminUserByEmail: vi.fn(() => ({ id: 9 })),
		});
		const r = repository.inviteAdminUser(
			{ name: "X", email: "x@example.com", role: "editor" },
			actor,
		);
		expect(r).toEqual({
			ok: false,
			error: "That email address already belongs to an admin user.",
		});
		expect(createInvitedAdminUser).not.toHaveBeenCalled();
	});

	it("returns could-not-be-created when createInvitedAdminUser returns false", () => {
		const { repository, insertUserInvite } = makeRepo({
			createInvitedAdminUser: vi.fn(() => false),
		});
		const r = repository.inviteAdminUser(
			{ name: "X", email: "x@example.com", role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "The invited user could not be created." });
		expect(insertUserInvite).not.toHaveBeenCalled();
	});

	it("returns could-not-be-created when getAdminUserIdByEmail returns falsy", () => {
		const { repository, insertUserInvite } = makeRepo({
			getAdminUserIdByEmail: vi.fn(() => null),
		});
		const r = repository.inviteAdminUser(
			{ name: "X", email: "x@example.com", role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "The invited user could not be created." });
		expect(insertUserInvite).not.toHaveBeenCalled();
	});

	it("returns invite-link-could-not-be-created when insertUserInvite returns false", () => {
		const { repository, recordUserAudit } = makeRepo({
			insertUserInvite: vi.fn(() => false),
		});
		const r = repository.inviteAdminUser(
			{ name: "X", email: "x@example.com", role: "editor" },
			actor,
		);
		expect(r).toEqual({ ok: false, error: "The invitation link could not be created." });
		expect(recordUserAudit).not.toHaveBeenCalled();
	});
});

describe("user repository factory — suspendAdminUser", () => {
	it("normalises email (trim + lowercase), suspends, revokes sessions, and dispatches audit", () => {
		const { repository, setAdminUserActiveState, revokeAdminSessionsForEmail, recordUserAudit } =
			makeRepo();
		const result = repository.suspendAdminUser("  Editor@Example.com  ", actor);
		expect(result).toEqual({ ok: true });
		expect(setAdminUserActiveState).toHaveBeenCalledWith("editor@example.com", false);
		expect(revokeAdminSessionsForEmail).toHaveBeenCalledWith("editor@example.com");
		expect(recordUserAudit).toHaveBeenCalledWith({
			actor,
			action: "user.suspend",
			summary: "Suspended editor@example.com.",
			targetId: "editor@example.com",
		});
	});

	it("rejects an empty email with the email-required error", () => {
		const { repository, setAdminUserActiveState } = makeRepo();
		expect(repository.suspendAdminUser("   ", actor)).toEqual({
			ok: false,
			error: "Email is required.",
		});
		expect(setAdminUserActiveState).not.toHaveBeenCalled();
	});

	it("refuses to suspend the actor's own account (case-insensitive match)", () => {
		const { repository, setAdminUserActiveState } = makeRepo();
		expect(
			repository.suspendAdminUser("Admin@Example.com", { ...actor, email: "admin@example.com" }),
		).toEqual({
			ok: false,
			error: "You cannot suspend the account you are currently using.",
		});
		expect(setAdminUserActiveState).not.toHaveBeenCalled();
	});

	it("returns the suspend-failure error when setAdminUserActiveState returns false", () => {
		const { repository, revokeAdminSessionsForEmail, recordUserAudit } = makeRepo({
			setAdminUserActiveState: vi.fn(() => false),
		});
		const r = repository.suspendAdminUser("editor@example.com", actor);
		expect(r).toEqual({ ok: false, error: "That admin user could not be suspended." });
		expect(revokeAdminSessionsForEmail).not.toHaveBeenCalled();
		expect(recordUserAudit).not.toHaveBeenCalled();
	});
});

describe("user repository factory — unsuspendAdminUser", () => {
	it("normalises email and restores active state with a user.restore audit", () => {
		const { repository, setAdminUserActiveState, recordUserAudit } = makeRepo();
		const r = repository.unsuspendAdminUser("  Editor@Example.com  ", actor);
		expect(r).toEqual({ ok: true });
		expect(setAdminUserActiveState).toHaveBeenCalledWith("editor@example.com", true);
		expect(recordUserAudit).toHaveBeenCalledWith({
			actor,
			action: "user.restore",
			summary: "Restored editor@example.com.",
			targetId: "editor@example.com",
		});
	});

	it("rejects an empty email with the email-required error", () => {
		const { repository } = makeRepo();
		expect(repository.unsuspendAdminUser("", actor)).toEqual({
			ok: false,
			error: "Email is required.",
		});
	});

	it("returns the restore-failure error when setAdminUserActiveState returns false", () => {
		const { repository, recordUserAudit } = makeRepo({
			setAdminUserActiveState: vi.fn(() => false),
		});
		const r = repository.unsuspendAdminUser("editor@example.com", actor);
		expect(r).toEqual({ ok: false, error: "That admin user could not be restored." });
		expect(recordUserAudit).not.toHaveBeenCalled();
	});
});

describe("user repository factory — listAdminUsers passthrough", () => {
	it("forwards listAdminUsers result and call count", () => {
		const expected = [{ id: 1, email: "a@b.c", name: "A", role: "admin", active: 1 }];
		const listAdminUsers = vi.fn(() => expected);
		const { repository } = makeRepo({
			listAdminUsers: listAdminUsers as unknown as Parameters<
				typeof createAstropressUserRepository
			>[0]["listAdminUsers"],
		});
		expect(repository.listAdminUsers()).toBe(expected);
		expect(listAdminUsers).toHaveBeenCalledTimes(1);
	});
});
