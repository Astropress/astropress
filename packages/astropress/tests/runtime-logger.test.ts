import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importLoggerWith(env: Record<string, string | undefined>) {
	vi.resetModules();
	const prev: Record<string, string | undefined> = {};
	for (const k of Object.keys(env)) {
		prev[k] = process.env[k];
		if (env[k] === undefined) delete process.env[k];
		else process.env[k] = env[k];
	}
	const mod = await import("../src/runtime-logger");
	for (const k of Object.keys(env)) {
		if (prev[k] === undefined) delete process.env[k];
		else process.env[k] = prev[k];
	}
	return mod;
}

describe("createLogger (dev mode)", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("info() prints with [astropress:context] prefix and message", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("auth").info("hello");
		expect(logSpy).toHaveBeenCalledWith("[astropress:auth]", "hello");
	});

	it("info() includes meta argument when provided non-empty", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").info("hi", { user: "u1" });
		expect(logSpy).toHaveBeenCalledWith("[astropress:svc]", "hi", {
			user: "u1",
		});
	});

	it("info() omits meta argument when meta is empty object", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").info("hi", {});
		expect(logSpy).toHaveBeenCalledWith("[astropress:svc]", "hi");
	});

	it("warn() routes to console.warn", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").warn("careful");
		expect(warnSpy).toHaveBeenCalledWith("[astropress:svc]", "careful");
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("error() routes to console.error", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").error("boom");
		expect(errorSpy).toHaveBeenCalledWith("[astropress:svc]", "boom");
	});

	it("error() with meta routes to console.error including meta", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").error("boom", { code: 5 });
		expect(errorSpy).toHaveBeenCalledWith("[astropress:svc]", "boom", {
			code: 5,
		});
	});

	it("warn() with meta routes to console.warn including meta", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
		});
		createLogger("svc").warn("careful", { reason: "x" });
		expect(warnSpy).toHaveBeenCalledWith("[astropress:svc]", "careful", {
			reason: "x",
		});
	});

	it("LOG_LEVEL=error suppresses info and warn but keeps error", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "error",
		});
		const l = createLogger("svc");
		l.info("nope");
		l.warn("nope");
		l.error("yep");
		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
	});

	it("LOG_LEVEL=warn suppresses info but keeps warn and error", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "warn",
		});
		const l = createLogger("svc");
		l.info("nope");
		l.warn("yep1");
		l.error("yep2");
		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
	});

	it("invalid LOG_LEVEL falls back to info", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "verbose-not-real",
		});
		createLogger("svc").info("hi");
		expect(logSpy).toHaveBeenCalled();
	});

	it("missing LOG_LEVEL falls back to info", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: undefined,
		});
		createLogger("svc").info("hi");
		expect(logSpy).toHaveBeenCalled();
	});

	it("LOG_LEVEL is matched case-insensitively (uppercase WARN -> warn)", async () => {
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "development",
			LOG_LEVEL: "WARN",
		});
		const l = createLogger("svc");
		l.info("nope");
		l.warn("yep");
		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalled();
	});
});

describe("createLogger (production / JSON mode)", () => {
	it("writes a JSON envelope to stderr with level/context/message/timestamp", async () => {
		const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "production",
			LOG_LEVEL: "info",
		});
		createLogger("svc").info("hi", { user: "u1" });
		expect(writeSpy).toHaveBeenCalledTimes(1);
		const written = String(writeSpy.mock.calls[0]?.[0] ?? "");
		expect(written.endsWith("\n")).toBe(true);
		const parsed = JSON.parse(written.trim());
		expect(parsed.level).toBe("info");
		expect(parsed.context).toBe("svc");
		expect(parsed.message).toBe("hi");
		expect(parsed.user).toBe("u1");
		expect(typeof parsed.timestamp).toBe("string");
		expect(() => new Date(parsed.timestamp)).not.toThrow();
		writeSpy.mockRestore();
	});

	it("respects LOG_LEVEL filter in production mode", async () => {
		const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		const { createLogger } = await importLoggerWith({
			NODE_ENV: "production",
			LOG_LEVEL: "error",
		});
		const l = createLogger("svc");
		l.info("nope");
		l.warn("nope");
		l.error("yep");
		expect(writeSpy).toHaveBeenCalledTimes(1);
		const parsed = JSON.parse(String(writeSpy.mock.calls[0]?.[0]).trim());
		expect(parsed.level).toBe("error");
		writeSpy.mockRestore();
	});
});
