import { describe, expect, it } from "vitest";

import {
	err,
	isErr,
	isOk,
	mapResult,
	none,
	ok,
	some,
	unwrapOr,
} from "../src/result";

describe("result helpers", () => {
	it("ok narrows correctly via isOk and exposes value", () => {
		const r = ok(42);
		expect(isOk(r)).toBe(true);
		expect(isErr(r)).toBe(false);
		if (isOk(r)) expect(r.value).toBe(42);
	});

	it("err narrows correctly via isErr and exposes error", () => {
		const r = err(new Error("nope"));
		expect(isErr(r)).toBe(true);
		expect(isOk(r)).toBe(false);
		if (isErr(r)) expect(r.error.message).toBe("nope");
	});

	it("unwrapOr returns the value or fallback", () => {
		expect(unwrapOr(ok("x"), "y")).toBe("x");
		expect(unwrapOr(err<Error>(new Error("e")), "y")).toBe("y");
	});

	it("mapResult transforms ok values, leaves err untouched", () => {
		expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6));
		const e = err<Error>(new Error("nope"));
		expect(mapResult(e, (n: number) => n + 1)).toBe(e);
	});

	it("some / none discriminate via .some", () => {
		const s = some("hello");
		expect(s.some).toBe(true);
		expect(none.some).toBe(false);
		if (s.some) expect(s.value).toBe("hello");
	});
});
