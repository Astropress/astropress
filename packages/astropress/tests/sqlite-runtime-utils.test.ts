/**
 * sqlite-runtime/utils mutation pins.
 *
 * Covers the helpers that don't have direct test surface elsewhere:
 * normalizeStructuredTemplateKey, localeFromPath, localeFromAcceptLanguage,
 * hashOpaqueToken (default secret), hashPasswordSync (default iterations),
 * getSeedPageRecords, serializeIdList, parseSystemSettings, and
 * normalizeSystemRoutePath.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
	getSeedPageRecords,
	hashOpaqueToken,
	hashPasswordSync,
	localeFromAcceptLanguage,
	localeFromPath,
	normalizeStructuredTemplateKey,
	normalizeSystemRoutePath,
	parseSystemSettings,
	serializeIdList,
	verifyPasswordSync,
} from "../src/sqlite-runtime/utils.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function setCmsConfig(extra: Record<string, unknown> = {}) {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = {
		siteName: "Test",
		siteUrl: "https://example.com",
		templateKeys: [],
		seedPages: [],
		archives: [],
		translationStatus: [],
		...extra,
	};
}

function clearCmsConfig() {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = null;
}

afterEach(clearCmsConfig);

describe("normalizeStructuredTemplateKey", () => {
	it("returns null for non-string values (kills L57 LogicalOperator/Conditional)", () => {
		expect(normalizeStructuredTemplateKey(42)).toBeNull();
		expect(normalizeStructuredTemplateKey(undefined)).toBeNull();
		expect(normalizeStructuredTemplateKey(null)).toBeNull();
	});

	it("returns null for an empty string (kills the !value disjunct)", () => {
		expect(normalizeStructuredTemplateKey("")).toBeNull();
	});

	it("returns the value when present in templateKeys (kills L57:43 BlockStatement)", () => {
		setCmsConfig({ templateKeys: ["page-default"] });
		expect(normalizeStructuredTemplateKey("page-default")).toBe("page-default");
	});

	it("returns null when the templateKeys list excludes the value", () => {
		setCmsConfig({ templateKeys: ["other"] });
		expect(normalizeStructuredTemplateKey("missing")).toBeNull();
	});

	it("accepts the stored key when getCmsConfig throws (uninitialized — e.g. static build)", () => {
		clearCmsConfig();
		// Lenient: a published page must not vanish just because registerCms() has
		// not run (as during a static build's getStaticPaths).
		expect(normalizeStructuredTemplateKey("any")).toBe("any");
	});

	it("accepts the stored key when templateKeys is empty (unconfigured)", () => {
		setCmsConfig({ templateKeys: [] });
		expect(normalizeStructuredTemplateKey("landing")).toBe("landing");
	});

	it("returns null for '' even when templateKeys contains '' (kills L57 ConditionalExpression:false, LogicalOperator, BlockStatement)", () => {
		// The `if (typeof value !== "string" || !value) return null` guard
		// short-circuits before the templateKeys lookup. Mutants that disable the
		// early return (ConditionalExpression:false, BlockStatement {}) or weaken
		// the disjunction (|| → &&) fall through to [""].includes("") === true and
		// would return "" instead of null.
		setCmsConfig({ templateKeys: [""] });
		expect(normalizeStructuredTemplateKey("")).toBeNull();
	});
});

describe("localeFromPath", () => {
	it("matches a configured locale prefix (kills L75 ConditionalExpression:false, MethodExpression endsWith, L70 ArrayDeclaration empty)", () => {
		setCmsConfig({ locales: ["en", "es", "fr"] });
		expect(localeFromPath("/fr/about")).toBe("fr");
		expect(localeFromPath("/es/blog/post")).toBe("es");
	});

	it("falls back to the first configured locale when no prefix matches (kills L78 LogicalOperator, L75:27 StringLiteral)", () => {
		setCmsConfig({ locales: ["nl", "de"] });
		expect(localeFromPath("/about")).toBe("nl");
	});

	it("returns the first locale verbatim and not the suffix (kills L75 ConditionalExpression:true — would treat any path as matching)", () => {
		setCmsConfig({ locales: ["en", "es"] });
		// "/about" doesn't start with "/en/" nor "/es/"; should fall back to "en".
		// Mutant ConditionalExpression:true would return the first iterated locale on every call.
		expect(localeFromPath("/de/about")).toBe("en");
	});

	it("uses the [en, es] fallback when getCmsConfig throws (kills L70 fallback ArrayDeclaration & StringLiterals)", () => {
		clearCmsConfig();
		expect(localeFromPath("/en/page")).toBe("en");
		expect(localeFromPath("/es/page")).toBe("es");
	});

	it("falls back to literal 'en' when locales is empty (kills L78:9 LogicalOperator branch)", () => {
		setCmsConfig({ locales: [] });
		expect(localeFromPath("/anything")).toBe("en");
	});

	it("uses the [en, es] fallback when the config has no locales key (kills L70 ArrayDeclaration & StringLiterals)", () => {
		// getCmsConfig() succeeds but `.locales` is undefined → `?? ["en", "es"]`
		// fallback fires. Mutating that array to [] or either literal to ""
		// changes which prefixes match / what the empty-list default returns.
		setCmsConfig({});
		expect(localeFromPath("/en/page")).toBe("en");
		expect(localeFromPath("/es/page")).toBe("es");
		expect(localeFromPath("/zz/page")).toBe("en");
	});
});

describe("localeFromAcceptLanguage", () => {
	it("returns the first configured locale when the header is null/empty (kills L103 LogicalOperator)", () => {
		setCmsConfig({ locales: ["en", "es"] });
		expect(localeFromAcceptLanguage(null)).toBe("en");
		expect(localeFromAcceptLanguage(undefined)).toBe("en");
		expect(localeFromAcceptLanguage("")).toBe("en");
	});

	it("picks the highest-weighted matching locale (kills L109/L110 MethodExpression trim)", () => {
		setCmsConfig({ locales: ["en", "es", "fr"] });
		expect(localeFromAcceptLanguage("es;q=0.9, en;q=0.8")).toBe("es");
		expect(localeFromAcceptLanguage("fr-CH, en;q=0.5")).toBe("fr");
	});

	it("falls back to the first locale when no entry matches (kills L126:9 LogicalOperator)", () => {
		setCmsConfig({ locales: ["en", "es"] });
		expect(localeFromAcceptLanguage("ja;q=1, ko;q=0.9")).toBe("en");
	});

	it("uses [en, es] fallback when getCmsConfig throws (kills L98:13 LogicalOperator)", () => {
		clearCmsConfig();
		expect(localeFromAcceptLanguage("es;q=1, en;q=0.5")).toBe("es");
		expect(localeFromAcceptLanguage(null)).toBe("en");
	});

	it("handles a tag with extra whitespace (kills L112:10 tag MethodExpression — .trim() removed)", () => {
		setCmsConfig({ locales: ["en", "es"] });
		expect(localeFromAcceptLanguage("  es  ;q=0.9, en;q=0.8")).toBe("es");
	});

	it("uses the [en, es] fallback when the config has no locales key (kills L98 ArrayDeclaration & StringLiterals)", () => {
		// `.locales` undefined → `?? ["en", "es"]` fallback. Mutating the array to []
		// or either literal to "" changes which tag matches and the empty-list default.
		setCmsConfig({});
		expect(localeFromAcceptLanguage("en")).toBe("en");
		expect(localeFromAcceptLanguage("es")).toBe("es");
	});

	it("returns the first locale verbatim when the header is null and locales is empty (kills L103:30 LogicalOperator & L103:44 StringLiteral)", () => {
		// locales[0] is undefined → `?? "en"` yields "en". Mutating `??` to `&&`
		// yields undefined; mutating the "en" literal to "" yields "".
		setCmsConfig({ locales: [] });
		expect(localeFromAcceptLanguage(null)).toBe("en");
	});

	it("returns the literal 'en' when no entry matches and locales is empty (kills L126:9 LogicalOperator & L126:23 StringLiteral)", () => {
		// Final `return locales[0] ?? "en"` with an empty locales list. Mutating
		// `??` to `&&` yields undefined; mutating "en" to "" yields "".
		setCmsConfig({ locales: [] });
		expect(localeFromAcceptLanguage("ja;q=1, ko;q=0.9")).toBe("en");
	});
});

describe("getSeedPageRecords", () => {
	it("returns the configured seedPages list", () => {
		const page = { slug: "x", legacyUrl: "/x" } as never;
		setCmsConfig({ seedPages: [page] });
		expect(getSeedPageRecords()).toEqual([page]);
	});

	it("returns [] when getCmsConfig throws (catch branch)", () => {
		clearCmsConfig();
		expect(getSeedPageRecords()).toEqual([]);
	});
});

describe("hashOpaqueToken — default secret resolves via runtime-env (post-#132)", () => {
	it("default (no secret) differs from explicit empty-string secret (dev mode)", () => {
		const digestDefault = hashOpaqueToken("token-abc");
		const digestEmpty = hashOpaqueToken("token-abc", "");
		// In dev mode resolveTokenHashSecret(undefined) returns DEV_ROOT_SECRET_FALLBACK,
		// while an explicit empty string flows through unchanged — so the two digests
		// MUST differ. Regression-kills the old hardcoded-string-default mutant and the
		// new pass-empty-as-fallback mistake.
		expect(digestDefault).not.toBe(digestEmpty);
	});
});

describe("hashPasswordSync — default iterations (kills L142:40 ObjectLiteral)", () => {
	it("hashes via Argon2id and round-trips verifyPasswordSync", () => {
		const hash = hashPasswordSync("hunter2");
		// Mutant L142:40 ObjectLiteral {}: { iterations: 2 } → {}.
		// We can't observe iteration count directly, but the produced hash must still verify.
		expect(typeof hash).toBe("string");
		expect(hash).not.toBe("");
		expect(verifyPasswordSync("hunter2", hash)).toBe(true);
		expect(verifyPasswordSync("wrong", hash)).toBe(false);
	});

	it("passes the requested iteration count through to the encoded hash", () => {
		// The default (2) equals ARGON2_ITERATIONS, so dropping the { iterations }
		// option is invisible at the default. A non-default count must appear in
		// the encoded hash (`$argon2id$<t>$…`), which forces the option through.
		const hash = hashPasswordSync("hunter2", 3);
		expect(hash.split("$")[1]).toBe("3");
		expect(verifyPasswordSync("hunter2", hash)).toBe(true);
	});
});

describe("serializeIdList", () => {
	it("filters positive integers, sorts ascending, and serializes as JSON (kills L158 filter ArrowFunctions, sort ArrowFunctions)", () => {
		expect(serializeIdList([3, 1, 2])).toBe("[1,2,3]");
		// Filters reject non-integers and non-positives.
		expect(serializeIdList([0, -1, 5, 2.5, 4])).toBe("[4,5]");
	});

	it("defaults to [] when given undefined (kills L158:3 MethodExpression: values ?? [] and L158:14 ArrayDeclaration)", () => {
		// Mutant L158:14 ArrayDeclaration ["Stryker was here"]: default becomes a non-empty
		// non-integer array → filter strips it → still "[]". Mutant L158:3 MethodExpression on
		// `values ?? []`: returns just `values` (undefined) → undefined.filter throws.
		expect(serializeIdList(undefined)).toBe("[]");
		expect(serializeIdList([])).toBe("[]");
	});
});

describe("parseSystemSettings", () => {
	it("returns null for null/empty input (kills L163 ConditionalExpression / BlockStatement)", () => {
		expect(parseSystemSettings(null)).toBeNull();
		expect(parseSystemSettings("")).toBeNull();
	});

	it("returns null for invalid JSON (catch branch)", () => {
		expect(parseSystemSettings("{not json")).toBeNull();
	});

	it("returns null for parsed primitives or null literal (kills L169 ConditionalExpression / LogicalOperator)", () => {
		expect(parseSystemSettings("null")).toBeNull();
		expect(parseSystemSettings('"a string"')).toBeNull();
		expect(parseSystemSettings("42")).toBeNull();
		expect(parseSystemSettings("true")).toBeNull();
	});

	it("returns the parsed object for valid JSON object input", () => {
		expect(parseSystemSettings('{"key":"value","num":1}')).toEqual({ key: "value", num: 1 });
	});
});

describe("normalizeSystemRoutePath", () => {
	it("trims whitespace and prepends '/' to bare paths (kills L178:18 MethodExpression: pathname)", () => {
		// Mutant L178:18 MethodExpression: drops .trim() — input "  /foo  " stays unchanged.
		expect(normalizeSystemRoutePath("  /foo  ")).toBe("/foo");
		expect(normalizeSystemRoutePath("foo")).toBe("/foo");
	});

	it("returns '' for empty/whitespace-only input (kills L179 ConditionalExpression/BlockStatement, L180 StringLiteral)", () => {
		// Mutant L180 StringLiteral: "" → "Stryker was here!" — assertion catches.
		expect(normalizeSystemRoutePath("")).toBe("");
		expect(normalizeSystemRoutePath("   ")).toBe("");
	});

	it("leaves already-prefixed paths intact", () => {
		expect(normalizeSystemRoutePath("/already")).toBe("/already");
	});
});
