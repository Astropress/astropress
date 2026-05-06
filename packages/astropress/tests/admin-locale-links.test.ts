import { afterEach, describe, expect, it } from "vitest";

import { getAdminLocalePair, normalizeRoute } from "../src/admin-locale-links";
import { registerCms } from "../src/config";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

afterEach(() => {
	(globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[CMS_CONFIG_KEY] = null;
});

const TRANSLATION_STATUS = [
	{
		route: "/es/sobre",
		locale: "es",
		englishSourceUrl: "/about",
		translationState: "published",
	},
	{
		route: "/es/contacto",
		locale: "es",
		englishSourceUrl: "/contact",
		translationState: "in_progress",
	},
];

function setup() {
	registerCms({
		siteUrl: "https://example.org",
		templateKeys: ["home"],
		seedPages: [],
		archives: [],
		translationStatus: TRANSLATION_STATUS as never,
	} as never);
}

describe("getAdminLocalePair", () => {
	it("returns es pair when route matches a localized entry", () => {
		setup();
		const pair = getAdminLocalePair("/es/sobre");
		expect(pair).toEqual({
			currentLocale: "es",
			englishRoute: "/about",
			localizedRoute: "/es/sobre",
			translationState: "published",
		});
	});

	it("returns en pair when route matches an englishSourceUrl", () => {
		setup();
		const pair = getAdminLocalePair("/about");
		expect(pair).toEqual({
			currentLocale: "en",
			englishRoute: "/about",
			localizedRoute: "/es/sobre",
			translationState: "published",
		});
	});

	it("returns null when route matches nothing", () => {
		setup();
		expect(getAdminLocalePair("/nope")).toBeNull();
	});

	it("normalizes trailing slashes before matching (localized side)", () => {
		setup();
		expect(getAdminLocalePair("/es/sobre/")?.currentLocale).toBe("es");
		expect(getAdminLocalePair("/es/sobre//")?.currentLocale).toBe("es");
	});

	it("normalizes trailing slashes before matching (english side)", () => {
		setup();
		expect(getAdminLocalePair("/about/")?.currentLocale).toBe("en");
	});

	it("treats empty input as '/' (no match in fixture)", () => {
		setup();
		expect(getAdminLocalePair("")).toBeNull();
	});

	it("treats only-slash input as '/'", () => {
		setup();
		expect(getAdminLocalePair("/")).toBeNull();
	});

	it("a string of all slashes normalizes to '/'", () => {
		setup();
		// "////" → trim trailing slashes leaves "" → return "/"
		expect(getAdminLocalePair("////")).toBeNull();
	});

	it("propagates translationState verbatim from the matching entry", () => {
		setup();
		expect(getAdminLocalePair("/es/contacto")?.translationState).toBe("in_progress");
	});
});

describe("normalizeRoute", () => {
	it("returns '/' for empty input", () => {
		expect(normalizeRoute("")).toBe("/");
	});

	it("returns '/' for undefined-coerced falsy input", () => {
		// Pins the !route branch — a mutant that drops it would try to
		// regex-replace on "" and return "" instead.
		expect(normalizeRoute("")).toBe("/");
	});

	it("returns '/' for a single slash", () => {
		expect(normalizeRoute("/")).toBe("/");
	});

	it("returns '/' for any all-slashes string", () => {
		// Pins the `trimmed === "" ? "/" : trimmed` ternary — without the
		// fallback the function would return "" for these inputs.
		expect(normalizeRoute("//")).toBe("/");
		expect(normalizeRoute("///")).toBe("/");
		expect(normalizeRoute("////")).toBe("/");
	});

	it("strips a single trailing slash", () => {
		expect(normalizeRoute("/about/")).toBe("/about");
	});

	it("strips multiple trailing slashes", () => {
		expect(normalizeRoute("/about///")).toBe("/about");
	});

	it("returns the route unchanged when there is no trailing slash", () => {
		expect(normalizeRoute("/about")).toBe("/about");
		expect(normalizeRoute("/es/sobre")).toBe("/es/sobre");
	});

	it("does not strip non-trailing slashes", () => {
		expect(normalizeRoute("/a/b/c")).toBe("/a/b/c");
		expect(normalizeRoute("/a//b/")).toBe("/a//b");
	});
});
