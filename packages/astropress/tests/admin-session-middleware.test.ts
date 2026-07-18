import { beforeEach, describe, expect, it, vi } from "vitest";

// Pull in the ambient `App.Locals` augmentation (contributes no runtime code).
import type {} from "../src/access/locals";
import {
	LEGACY_SESSION_COOKIE,
	LOCAL_SESSION_COOKIE,
	SECURE_SESSION_COOKIE,
} from "../src/admin-action-utils-data";

const getRuntimeSessionUser = vi.fn();
const getRuntimeCsrfToken = vi.fn();
const getLoginSecurityConfig = vi.fn();

vi.mock("../src/runtime-admin-auth", () => ({
	getRuntimeSessionUser: (...args: unknown[]) => getRuntimeSessionUser(...args),
	getRuntimeCsrfToken: (...args: unknown[]) => getRuntimeCsrfToken(...args),
}));
vi.mock("../src/runtime-env", () => ({
	getLoginSecurityConfig: (...args: unknown[]) => getLoginSecurityConfig(...args),
}));

const { createAstropressAdminSessionMiddleware } = await import("../src/admin-session-middleware");

type Cookie = { value: string };

function makeContext(cookies: Record<string, string>, seedLocals: Record<string, unknown> = {}) {
	const locals = { ...seedLocals } as App.Locals;
	return {
		cookies: {
			get(name: string): Cookie | undefined {
				return name in cookies ? { value: cookies[name] } : undefined;
			},
		},
		locals,
	};
}

const response = new Response("ok");
const next = vi.fn(async () => response);

beforeEach(() => {
	vi.clearAllMocks();
	getLoginSecurityConfig.mockReturnValue({ secureCookies: false });
	next.mockResolvedValue(response);
});

describe("createAstropressAdminSessionMiddleware", () => {
	it("populates locals.adminUser and csrfToken from a valid local session cookie", async () => {
		getRuntimeSessionUser.mockResolvedValue({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
			isAdmin: true,
		});
		getRuntimeCsrfToken.mockResolvedValue("csrf-123");

		const mw = createAstropressAdminSessionMiddleware();
		const ctx = makeContext({ [LOCAL_SESSION_COOKIE]: "tok" });
		const result = await mw(ctx, next);

		expect(getRuntimeSessionUser).toHaveBeenCalledWith("tok", ctx.locals);
		expect(ctx.locals.adminUser).toEqual({
			id: "admin@example.com",
			email: "admin@example.com",
			isAdmin: true,
			name: "Admin",
		});
		expect(ctx.locals.csrfToken).toBe("csrf-123");
		expect(next).toHaveBeenCalledOnce();
		expect(result).toBe(response);
	});

	it("reads the secure cookie when secureCookies is true", async () => {
		getLoginSecurityConfig.mockReturnValue({ secureCookies: true });
		getRuntimeSessionUser.mockResolvedValue({
			email: "e@example.com",
			role: "editor",
			name: "Ed",
			isAdmin: false,
		});
		getRuntimeCsrfToken.mockResolvedValue("csrf");

		const mw = createAstropressAdminSessionMiddleware();
		// Only the secure cookie is present; a local cookie must be ignored here.
		const ctx = makeContext({ [SECURE_SESSION_COOKIE]: "sec-tok" });
		await mw(ctx, next);

		expect(getRuntimeSessionUser).toHaveBeenCalledWith("sec-tok", ctx.locals);
		expect(ctx.locals.adminUser?.isAdmin).toBe(false);
	});

	it("falls back to the legacy cookie", async () => {
		getRuntimeSessionUser.mockResolvedValue({
			email: "a@example.com",
			role: "admin",
			name: "A",
			isAdmin: true,
		});
		getRuntimeCsrfToken.mockResolvedValue(null);

		const mw = createAstropressAdminSessionMiddleware();
		const ctx = makeContext({ [LEGACY_SESSION_COOKIE]: "legacy-tok" });
		await mw(ctx, next);

		expect(getRuntimeSessionUser).toHaveBeenCalledWith("legacy-tok", ctx.locals);
		expect(ctx.locals.adminUser?.email).toBe("a@example.com");
		expect(ctx.locals.csrfToken).toBeUndefined();
	});

	it("no-ops when no session cookie is present", async () => {
		const mw = createAstropressAdminSessionMiddleware();
		const ctx = makeContext({});
		await mw(ctx, next);

		expect(getRuntimeSessionUser).not.toHaveBeenCalled();
		expect(ctx.locals.adminUser).toBeUndefined();
		expect(next).toHaveBeenCalledOnce();
	});

	it("leaves adminUser undefined when the token resolves to no user", async () => {
		getRuntimeSessionUser.mockResolvedValue(null);

		const mw = createAstropressAdminSessionMiddleware();
		const ctx = makeContext({ [LOCAL_SESSION_COOKIE]: "stale" });
		await mw(ctx, next);

		expect(getRuntimeSessionUser).toHaveBeenCalledOnce();
		expect(getRuntimeCsrfToken).not.toHaveBeenCalled();
		expect(ctx.locals.adminUser).toBeUndefined();
	});

	it("never clobbers an adminUser a host or the harness already set", async () => {
		const preset = { id: "harness", email: "harness@example.com", isAdmin: true, name: "Harness" };
		const mw = createAstropressAdminSessionMiddleware();
		const ctx = makeContext({ [LOCAL_SESSION_COOKIE]: "tok" }, { adminUser: preset });
		await mw(ctx, next);

		expect(getRuntimeSessionUser).not.toHaveBeenCalled();
		expect(ctx.locals.adminUser).toBe(preset);
	});
});
