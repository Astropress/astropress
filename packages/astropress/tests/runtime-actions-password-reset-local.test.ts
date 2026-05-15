// Local-store fallback paths for runtime-actions-password-reset.ts.
// When App.Locals has no D1 binding, withLocalStoreFallback dispatches to the
// LocalAdminStore module — these tests assert that the arrow-function fallbacks
// forward their arguments and return values rather than returning undefined.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { localStoreMock } = vi.hoisted(() => ({
	localStoreMock: {
		createPasswordResetToken: vi.fn(),
		getPasswordResetRequest: vi.fn(),
		consumePasswordResetToken: vi.fn(),
	},
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: vi.fn().mockResolvedValue(localStoreMock),
}));
vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: vi.fn().mockResolvedValue(localStoreMock),
}));

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let createRuntimePasswordResetToken: typeof import("../src/runtime-actions-password-reset.js").createRuntimePasswordResetToken;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimePasswordResetRequest: typeof import("../src/runtime-actions-password-reset.js").getRuntimePasswordResetRequest;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let consumeRuntimePasswordResetToken: typeof import("../src/runtime-actions-password-reset.js").consumeRuntimePasswordResetToken;

const NO_DB_LOCALS = undefined;

beforeEach(async () => {
	vi.resetModules();
	({
		createRuntimePasswordResetToken,
		getRuntimePasswordResetRequest,
		consumeRuntimePasswordResetToken,
	} = await import("../src/runtime-actions-password-reset.js"));
	localStoreMock.createPasswordResetToken.mockReset();
	localStoreMock.getPasswordResetRequest.mockReset();
	localStoreMock.consumePasswordResetToken.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

afterAll(() => {
	vi.resetModules();
});

describe("createRuntimePasswordResetToken — local fallback", () => {
	it("forwards (email, actor) to localStore.createPasswordResetToken and returns its result", async () => {
		const sentinel = { ok: true as const, resetUrl: "/local/reset?token=xyz" };
		localStoreMock.createPasswordResetToken.mockResolvedValueOnce(sentinel);
		const actor = { email: "admin@local", role: "admin" as const, name: "Local Admin" };
		const result = await createRuntimePasswordResetToken("u@local", actor, NO_DB_LOCALS);
		expect(localStoreMock.createPasswordResetToken).toHaveBeenCalledWith("u@local", actor);
		expect(result).toBe(sentinel);
	});

	it("coerces an undefined actor to null when forwarding", async () => {
		const sentinel = { ok: true as const, resetUrl: null };
		localStoreMock.createPasswordResetToken.mockResolvedValueOnce(sentinel);
		const result = await createRuntimePasswordResetToken("u@local", undefined, NO_DB_LOCALS);
		expect(localStoreMock.createPasswordResetToken).toHaveBeenCalledWith("u@local", null);
		expect(result).toBe(sentinel);
	});
});

describe("getRuntimePasswordResetRequest — local fallback", () => {
	it("forwards the token to localStore.getPasswordResetRequest and returns its result", async () => {
		const sentinel = { email: "u@local", name: "U", role: "editor" as const, expiresAt: "x" };
		localStoreMock.getPasswordResetRequest.mockResolvedValueOnce(sentinel);
		const result = await getRuntimePasswordResetRequest("raw-token", NO_DB_LOCALS);
		expect(localStoreMock.getPasswordResetRequest).toHaveBeenCalledWith("raw-token");
		expect(result).toBe(sentinel);
	});
});

describe("consumeRuntimePasswordResetToken — local fallback", () => {
	it("forwards (token, password) to localStore.consumePasswordResetToken and returns its result", async () => {
		const sentinel = { ok: true as const, user: { email: "u@local", role: "editor", name: "U" } };
		localStoreMock.consumePasswordResetToken.mockResolvedValueOnce(sentinel);
		const result = await consumeRuntimePasswordResetToken("raw-token", "pw", NO_DB_LOCALS);
		expect(localStoreMock.consumePasswordResetToken).toHaveBeenCalledWith("raw-token", "pw");
		expect(result).toBe(sentinel);
	});
});
