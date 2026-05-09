import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	dispatchPluginContentEvent,
	dispatchPluginMediaEvent,
	getPluginDispatchStats,
	reportAstropressError,
	resetPluginDispatchStats,
} from "../src/plugin-dispatch";

const CONFIG_KEY = Symbol.for("astropress.cms-config");

function setPlugins(plugins: unknown[] | null) {
	(globalThis as typeof globalThis & { [CONFIG_KEY]?: unknown })[CONFIG_KEY] =
		plugins === null ? null : { plugins };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	resetPluginDispatchStats();
});
afterEach(() => {
	setPlugins(null);
	vi.restoreAllMocks();
	resetPluginDispatchStats();
});

describe("dispatchPluginContentEvent", () => {
	it("is a no-op when no config is registered", async () => {
		setPlugins(null);
		await expect(dispatchPluginContentEvent("onContentSave", {} as never)).resolves.toBeUndefined();
	});

	it("is a no-op when plugin list is empty", async () => {
		setPlugins([]);
		await expect(dispatchPluginContentEvent("onContentSave", {} as never)).resolves.toBeUndefined();
	});

	it("invokes onContentSave on each plugin that defines it", async () => {
		const a = vi.fn();
		const b = vi.fn();
		setPlugins([
			{ name: "a", onContentSave: a },
			{ name: "b", onContentSave: b },
			{ name: "c" }, // no hook → skip
		]);
		const evt = { kind: "save" } as never;
		await dispatchPluginContentEvent("onContentSave", evt);
		expect(a).toHaveBeenCalledWith(evt);
		expect(b).toHaveBeenCalledWith(evt);
	});

	it("invokes onContentPublish for the publish hook", async () => {
		const fn = vi.fn();
		setPlugins([{ name: "p", onContentPublish: fn }]);
		await dispatchPluginContentEvent("onContentPublish", {} as never);
		expect(fn).toHaveBeenCalled();
	});

	it("skips plugins where the hook is not a function (boolean, string, undefined)", async () => {
		setPlugins([
			{ name: "x", onContentSave: true },
			{ name: "y", onContentSave: "not-a-fn" },
			{ name: "z" },
		]);
		await expect(dispatchPluginContentEvent("onContentSave", {} as never)).resolves.toBeUndefined();
		// Pins the `if (typeof fn !== "function") continue` mutation -> `if (false) continue`.
		// Without the type-guard the loop body would attempt `await fn(event)` on
		// a non-function, throw TypeError, and log via console.error.
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("returns early when config has no plugins property at all", async () => {
		// Pins the `config?.plugins?.length` -> `config?.plugins.length` mutation:
		// the mutant would TypeError on .length of undefined here.
		(globalThis as typeof globalThis & { [CONFIG_KEY]?: unknown })[CONFIG_KEY] = {};
		await expect(dispatchPluginContentEvent("onContentSave", {} as never)).resolves.toBeUndefined();
	});

	it("logs the failing plugin's name in the console.error message", async () => {
		// Pins the StringLiteral template -> `` mutation: the empty string
		// would not include the plugin name or hook.
		setPlugins([
			{
				name: "boom-plugin",
				onContentSave: () => {
					throw new Error("nope");
				},
				onError: () => {},
			},
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		expect(errorSpy).toHaveBeenCalled();
		const firstArg = String(errorSpy.mock.calls[0]?.[0] ?? "");
		expect(firstArg).toContain("boom-plugin");
		expect(firstArg).toContain("onContentSave");
	});

	it("catches plugin errors, logs, and forwards to onError of the same plugin", async () => {
		const onError = vi.fn();
		setPlugins([
			{
				name: "boom",
				onContentSave: () => {
					throw new Error("nope");
				},
				onError,
			},
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		expect(errorSpy).toHaveBeenCalled();
		expect(onError).toHaveBeenCalled();
		expect(onError.mock.calls[0]?.[1]).toBe("plugin:boom");
		expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
	});

	it("wraps non-Error throws into Error before calling onError", async () => {
		const onError = vi.fn();
		setPlugins([
			{
				name: "stringy",
				onContentSave: () => {
					throw "literal-string-throw";
				},
				onError,
			},
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		const wrapped = onError.mock.calls[0]?.[0] as Error;
		expect(wrapped).toBeInstanceOf(Error);
		expect(wrapped.message).toBe("literal-string-throw");
	});

	it("swallows errors thrown inside onError itself", async () => {
		setPlugins([
			{
				name: "boom",
				onContentSave: () => {
					throw new Error("nope");
				},
				onError: () => {
					throw new Error("on-error-also-broke");
				},
			},
		]);
		await expect(dispatchPluginContentEvent("onContentSave", {} as never)).resolves.toBeUndefined();
	});

	it("continues iterating remaining plugins after one throws", async () => {
		const second = vi.fn();
		setPlugins([
			{
				name: "first",
				onContentSave: () => {
					throw new Error("nope");
				},
				onError: () => {},
			},
			{ name: "second", onContentSave: second },
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		expect(second).toHaveBeenCalled();
	});
});

describe("dispatchPluginMediaEvent", () => {
	it("is a no-op when no plugins exist", async () => {
		setPlugins([]);
		await expect(dispatchPluginMediaEvent({} as never)).resolves.toBeUndefined();
	});

	it("invokes onMediaUpload on each plugin that defines it", async () => {
		const a = vi.fn();
		setPlugins([{ name: "a", onMediaUpload: a }, { name: "b" }]);
		const evt = { url: "x" } as never;
		await dispatchPluginMediaEvent(evt);
		expect(a).toHaveBeenCalledWith(evt);
	});

	it("catches plugin throws and forwards to onError", async () => {
		const onError = vi.fn();
		setPlugins([
			{
				name: "boom",
				onMediaUpload: () => {
					throw new Error("nope");
				},
				onError,
			},
		]);
		await dispatchPluginMediaEvent({} as never);
		expect(errorSpy).toHaveBeenCalled();
		expect(onError).toHaveBeenCalled();
		expect(onError.mock.calls[0]?.[1]).toBe("plugin:boom");
	});

	it("wraps non-Error media throws into Error", async () => {
		const onError = vi.fn();
		setPlugins([
			{
				name: "x",
				onMediaUpload: () => {
					throw 42;
				},
				onError,
			},
		]);
		await dispatchPluginMediaEvent({} as never);
		const wrapped = onError.mock.calls[0]?.[0] as Error;
		expect(wrapped).toBeInstanceOf(Error);
		expect(wrapped.message).toBe("42");
	});

	it("returns early when config has no plugins property at all (media)", async () => {
		(globalThis as typeof globalThis & { [CONFIG_KEY]?: unknown })[CONFIG_KEY] = {};
		await expect(dispatchPluginMediaEvent({} as never)).resolves.toBeUndefined();
	});

	it("skips plugins whose onMediaUpload is not a function (no errorSpy)", async () => {
		setPlugins([{ name: "x", onMediaUpload: true }, { name: "y" }]);
		await dispatchPluginMediaEvent({} as never);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("logs the failing plugin's name in console.error (media)", async () => {
		setPlugins([
			{
				name: "boom-media",
				onMediaUpload: () => {
					throw new Error("nope");
				},
				onError: () => {},
			},
		]);
		await dispatchPluginMediaEvent({} as never);
		const firstArg = String(errorSpy.mock.calls[0]?.[0] ?? "");
		expect(firstArg).toContain("boom-media");
		expect(firstArg).toContain("onMediaUpload");
	});
});

describe("reportAstropressError", () => {
	it("is a no-op when no plugins are configured", async () => {
		setPlugins(null);
		await expect(reportAstropressError(new Error("x"), "ctx")).resolves.toBeUndefined();
	});

	it("returns cleanly when config has no plugins property at all", async () => {
		// Pins the OptionalChaining mutation in dispatchPluginError:
		// `config?.plugins?.length` -> `config?.plugins.length` would throw
		// TypeError on `.length` of undefined here.
		(globalThis as typeof globalThis & { [CONFIG_KEY]?: unknown })[CONFIG_KEY] = {};
		await expect(reportAstropressError(new Error("x"), "ctx")).resolves.toBeUndefined();
	});

	it("calls onError on plugins with a function hook AND skips boolean/string non-function hooks (no side effects)", async () => {
		// Pins the `if (typeof fn !== "function") continue` mutation in
		// dispatchPluginError. With the mutant we'd try `await true(...)` /
		// `await undefined(...)` for the non-function plugins; those throws are
		// silently swallowed by the inner catch, so the only observable signal
		// is that the *function* plugin's hook receives EXACTLY one call (not
		// zero, not two) and the *non-function* plugin's onError value is not
		// invoked. We assert call counts to make this observable.
		const goodOnError = vi.fn();
		const badOnError = vi.fn(() => {
			throw new Error("should-not-be-called");
		});
		setPlugins([
			{ name: "non-fn", onError: "not-a-fn" },
			{ name: "good", onError: goodOnError },
			{ name: "bad-hook-target", onError: 42 },
		]);
		await reportAstropressError(new Error("boom"), "ctx");
		expect(goodOnError).toHaveBeenCalledTimes(1);
		expect(badOnError).not.toHaveBeenCalled();
	});

	it("forwards the error to every plugin's onError hook with the given context", async () => {
		const a = vi.fn();
		const b = vi.fn();
		setPlugins([
			{ name: "a", onError: a },
			{ name: "b", onError: b },
			{ name: "c" }, // no onError → skipped
		]);
		const err = new Error("boom");
		await reportAstropressError(err, "content-save");
		expect(a).toHaveBeenCalledWith(err, "content-save");
		expect(b).toHaveBeenCalledWith(err, "content-save");
	});

	it("wraps a non-Error argument into an Error before dispatching", async () => {
		const onError = vi.fn();
		setPlugins([{ name: "p", onError }]);
		await reportAstropressError("string-err", "ctx");
		const wrapped = onError.mock.calls[0]?.[0] as Error;
		expect(wrapped).toBeInstanceOf(Error);
		expect(wrapped.message).toBe("string-err");
		expect(onError.mock.calls[0]?.[1]).toBe("ctx");
	});

	it("swallows errors thrown inside onError", async () => {
		setPlugins([
			{
				name: "p",
				onError: () => {
					throw new Error("on-error-broke");
				},
			},
		]);
		await expect(reportAstropressError(new Error("x"), "ctx")).resolves.toBeUndefined();
	});
});

describe("getPluginDispatchStats", () => {
	it("starts empty", () => {
		expect(getPluginDispatchStats()).toEqual({});
	});

	it("records hooksRun for every successful content hook invocation", async () => {
		setPlugins([
			{ name: "a", onContentSave: () => {} },
			{ name: "b", onContentSave: () => {} },
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		const stats = getPluginDispatchStats();
		expect(stats.a?.hooksRun).toBe(2);
		expect(stats.b?.hooksRun).toBe(2);
		expect(stats.a?.errorsSwallowed).toBe(0);
	});

	it("records errorsSwallowed when a content hook throws", async () => {
		setPlugins([
			{
				name: "boom",
				onContentSave: () => {
					throw new Error("nope");
				},
				onError: () => {},
			},
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		const stats = getPluginDispatchStats();
		// Plugin "boom" had its onContentSave throw (errorsSwallowed += 1)
		// and its onError run successfully (hooksRun += 1).
		expect(stats.boom?.errorsSwallowed).toBe(1);
		expect(stats.boom?.hooksRun).toBe(1);
	});

	it("records errorsSwallowed when a media hook throws", async () => {
		setPlugins([
			{
				name: "media-boom",
				onMediaUpload: () => {
					throw new Error("nope");
				},
				onError: () => {},
			},
		]);
		await dispatchPluginMediaEvent({} as never);
		expect(getPluginDispatchStats()["media-boom"]).toEqual({
			hooksRun: 1,
			errorsSwallowed: 1,
		});
	});

	it("records errorsSwallowed when onError itself throws", async () => {
		setPlugins([
			{
				name: "double-fail",
				onContentSave: () => {
					throw new Error("hook");
				},
				onError: () => {
					throw new Error("on-error-also-broke");
				},
			},
		]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		const stats = getPluginDispatchStats();
		// onContentSave threw → errorsSwallowed = 1 from outer catch.
		// onError threw → errorsSwallowed = 2 from inner catch, hooksRun stays 0.
		expect(stats["double-fail"]?.errorsSwallowed).toBe(2);
		expect(stats["double-fail"]?.hooksRun).toBe(0);
	});

	it("returned object is a snapshot — mutating it does not affect future reads", async () => {
		setPlugins([{ name: "p", onContentSave: () => {} }]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		const snap = getPluginDispatchStats();
		snap.p.hooksRun = 99999;
		expect(getPluginDispatchStats().p?.hooksRun).toBe(1);
	});

	it("resetPluginDispatchStats clears every entry", async () => {
		setPlugins([{ name: "p", onContentSave: () => {} }]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		expect(Object.keys(getPluginDispatchStats())).toContain("p");
		resetPluginDispatchStats();
		expect(getPluginDispatchStats()).toEqual({});
	});

	it("does not record stats for plugins whose hook is not a function", async () => {
		setPlugins([{ name: "skipped", onContentSave: "not-a-fn" }]);
		await dispatchPluginContentEvent("onContentSave", {} as never);
		expect(getPluginDispatchStats().skipped).toBeUndefined();
	});
});
