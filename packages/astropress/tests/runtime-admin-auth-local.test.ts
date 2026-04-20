// @ts-nocheck
//
// Tests for runtime-admin-auth.ts when no D1 database is present (local store fallback paths).
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let authenticateRuntimeAdminUser: typeof import("../src/runtime-admin-auth.js").authenticateRuntimeAdminUser;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let createRuntimeSession: typeof import("../src/runtime-admin-auth.js").createRuntimeSession;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimeCsrfToken: typeof import("../src/runtime-admin-auth.js").getRuntimeCsrfToken;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimeSessionUser: typeof import("../src/runtime-admin-auth.js").getRuntimeSessionUser;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let recordRuntimeSuccessfulLogin: typeof import("../src/runtime-admin-auth.js").recordRuntimeSuccessfulLogin;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let recordRuntimeLogout: typeof import("../src/runtime-admin-auth.js").recordRuntimeLogout;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let revokeRuntimeSession: typeof import("../src/runtime-admin-auth.js").revokeRuntimeSession;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let _recordRuntimeAuditEvent: typeof import("../src/runtime-admin-auth.js")._recordRuntimeAuditEvent;

// Mock the local-runtime-modules so the fallback path doesn't throw.
const { localStoreMock, localAuthMock } = vi.hoisted(() => ({
	localStoreMock: {
		createSession: vi.fn(),
		getSessionUser: vi.fn(),
		getCsrfToken: vi.fn(),
		revokeSession: vi.fn(),
		recordSuccessfulLogin: vi.fn(),
		recordLogout: vi.fn(),
	},
	localAuthMock: {
		authenticateAdminUser: vi.fn(),
	},
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: vi.fn().mockResolvedValue(localStoreMock),
	loadLocalAdminAuth: vi.fn().mockResolvedValue(localAuthMock),
}));

vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: vi.fn().mockResolvedValue(localStoreMock),
	loadLocalAdminAuth: vi.fn().mockResolvedValue(localAuthMock),
}));

// Pass locals=undefined so getCloudflareBindings returns no DB → uses local store.
const NO_DB_LOCALS = undefined;

beforeEach(async () => {
	vi.resetModules();
	({
		authenticateRuntimeAdminUser,
		createRuntimeSession,
		getRuntimeCsrfToken,
		getRuntimeSessionUser,
		recordRuntimeSuccessfulLogin,
		recordRuntimeLogout,
		revokeRuntimeSession,
		_recordRuntimeAuditEvent,
	} = await import("../src/runtime-admin-auth.js"));
	localStoreMock.createSession.mockReset();
	localStoreMock.getSessionUser.mockReset();
	localStoreMock.getCsrfToken.mockReset();
	localStoreMock.revokeSession.mockReset();
	localStoreMock.recordSuccessfulLogin.mockReset();
	localStoreMock.recordLogout.mockReset();
	localAuthMock.authenticateAdminUser.mockReset();
});

afterAll(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("authenticateRuntimeAdminUser — local fallback", () => {
	it("delegates to localAdminAuth.authenticateAdminUser when no D1 DB is present", async () => {
		localAuthMock.authenticateAdminUser.mockResolvedValue({
			email: "admin@example.com",
			role: "admin",
			name: "Local Admin",
		});

		const result = await authenticateRuntimeAdminUser(
			"admin@example.com",
			"pass",
			NO_DB_LOCALS,
		);
		expect(localAuthMock.authenticateAdminUser).toHaveBeenCalledWith(
			"admin@example.com",
			"pass",
		);
		expect(result).toMatchObject({ email: "admin@example.com", role: "admin" });
	});

	it("returns null when local auth returns null", async () => {
		localAuthMock.authenticateAdminUser.mockResolvedValue(null);
		const result = await authenticateRuntimeAdminUser(
			"bad@example.com",
			"wrong",
			NO_DB_LOCALS,
		);
		expect(result).toBeNull();
	});
});

describe("createRuntimeSession — local fallback", () => {
	it("delegates to localStore.createSession when no D1 DB is present", async () => {
		localStoreMock.createSession.mockResolvedValue("local-session-token");

		const token = await createRuntimeSession(
			{ email: "admin@example.com", role: "admin", name: "Admin" },
			{ ipAddress: "127.0.0.1", userAgent: "vitest" },
			NO_DB_LOCALS,
		);
		expect(localStoreMock.createSession).toHaveBeenCalled();
		expect(token).toBe("local-session-token");
	});
});

describe("getRuntimeSessionUser — local fallback", () => {
	it("delegates to localStore.getSessionUser when no D1 DB is present", async () => {
		localStoreMock.getSessionUser.mockResolvedValue({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		});

		const user = await getRuntimeSessionUser("some-token", NO_DB_LOCALS);
		expect(localStoreMock.getSessionUser).toHaveBeenCalledWith("some-token");
		expect(user).toMatchObject({ email: "admin@example.com" });
	});

	it("returns null when local store returns null", async () => {
		localStoreMock.getSessionUser.mockResolvedValue(null);
		const user = await getRuntimeSessionUser("nonexistent", NO_DB_LOCALS);
		expect(user).toBeNull();
	});
});

describe("getRuntimeCsrfToken — local fallback", () => {
	it("delegates to localStore.getCsrfToken when no D1 DB is present", async () => {
		localStoreMock.getCsrfToken.mockResolvedValue("local-csrf-token");

		const token = await getRuntimeCsrfToken("some-token", NO_DB_LOCALS);
		expect(localStoreMock.getCsrfToken).toHaveBeenCalledWith("some-token");
		expect(token).toBe("local-csrf-token");
	});
});

describe("revokeRuntimeSession — local fallback", () => {
	it("delegates to localStore.revokeSession when no D1 DB is present", async () => {
		localStoreMock.revokeSession.mockResolvedValue(undefined);

		await revokeRuntimeSession("some-token", NO_DB_LOCALS);
		expect(localStoreMock.revokeSession).toHaveBeenCalledWith("some-token");
	});

	it("calls revokeSession even when sessionToken is null in local store path", async () => {
		localStoreMock.revokeSession.mockResolvedValue(undefined);
		await revokeRuntimeSession(null, NO_DB_LOCALS);
		expect(localStoreMock.revokeSession).toHaveBeenCalledWith(null);
	});
});

describe("recordRuntimeSuccessfulLogin — local fallback", () => {
	it("calls store.recordSuccessfulLogin when action is auth.login", async () => {
		localStoreMock.recordSuccessfulLogin.mockResolvedValue(undefined);
		const actor = {
			email: "admin@example.com",
			role: "admin" as const,
			name: "Admin",
		};

		await recordRuntimeSuccessfulLogin(actor, NO_DB_LOCALS);
		expect(localStoreMock.recordSuccessfulLogin).toHaveBeenCalledWith(actor);
	});
});

describe("recordRuntimeLogout — local fallback", () => {
	it("calls store.recordLogout when action is auth.logout", async () => {
		localStoreMock.recordLogout.mockResolvedValue(undefined);
		const actor = {
			email: "admin@example.com",
			role: "admin" as const,
			name: "Admin",
		};

		await recordRuntimeLogout(actor, NO_DB_LOCALS);
		expect(localStoreMock.recordLogout).toHaveBeenCalledWith(actor);
	});

	it("does NOT call recordSuccessfulLogin for a logout action", async () => {
		const actor = {
			email: "admin@example.com",
			role: "admin" as const,
			name: "Admin",
		};
		await recordRuntimeLogout(actor, NO_DB_LOCALS);
		expect(localStoreMock.recordSuccessfulLogin).not.toHaveBeenCalled();
		expect(localStoreMock.recordLogout).toHaveBeenCalledTimes(1);
	});

	it("does NOT call recordLogout for a login action", async () => {
		const actor = {
			email: "admin@example.com",
			role: "admin" as const,
			name: "Admin",
		};
		await recordRuntimeSuccessfulLogin(actor, NO_DB_LOCALS);
		expect(localStoreMock.recordLogout).not.toHaveBeenCalled();
		expect(localStoreMock.recordSuccessfulLogin).toHaveBeenCalledTimes(1);
	});
});

describe("_recordRuntimeAuditEvent — unmapped action", () => {
	it("calls neither recordSuccessfulLogin nor recordLogout for an unknown action", async () => {
		// Kills ConditionalExpression mutation on L265: else if (action === "auth.logout") → else if (true)
		// With mutation: any unmapped action triggers recordLogout; original: neither is called.
		const actor = {
			email: "admin@example.com",
			role: "admin" as const,
			name: "Admin",
		};
		await _recordRuntimeAuditEvent(
			"auth.other",
			"some summary",
			actor,
			NO_DB_LOCALS,
		);
		expect(localStoreMock.recordSuccessfulLogin).not.toHaveBeenCalled();
		expect(localStoreMock.recordLogout).not.toHaveBeenCalled();
	});
});
