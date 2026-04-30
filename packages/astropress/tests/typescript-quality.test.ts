/**
 * Tests for TypeScript quality features:
 * - Branded ID types (ContentId, MediaAssetId, AdminUserId, ApiTokenId, AuditEventId)
 * - ActionResult discriminated union
 */

import { describe, expect, it } from "vitest";
import { adminLabels } from "../src/admin-ui.js";
import type { AdminLabelKey, AdminLocale } from "../src/admin-ui.js";
import type {
	ActionResult,
	AdminUserId,
	ApiTokenId,
	AuditEventId,
	ContentId,
	MediaAssetId,
} from "../src/platform-contracts";

describe("Branded ID types", () => {
	it("ContentId is exported from platform-contracts", () => {
		// Type-level test: if this compiles, the type is exported and assignable
		const id = "record-123" as ContentId;
		expect(id).toBe("record-123");
	});

	it("MediaAssetId is exported from platform-contracts", () => {
		const id = "asset-456" as MediaAssetId;
		expect(id).toBe("asset-456");
	});

	it("AdminUserId is exported from platform-contracts", () => {
		const id = "user-789" as AdminUserId;
		expect(id).toBe("user-789");
	});

	it("ApiTokenId is exported from platform-contracts", () => {
		const id = "token-abc" as ApiTokenId;
		expect(id).toBe("token-abc");
	});

	it("AuditEventId is exported from platform-contracts", () => {
		const id = "event-def" as AuditEventId;
		expect(id).toBe("event-def");
	});

	it("branded string is still a string at runtime", () => {
		const id = "record-123" as ContentId;
		expect(typeof id).toBe("string");
		expect(String(id)).toBe("record-123");
	});
});

describe("ActionResult discriminated union", () => {
	it("ok result carries data", () => {
		const result: ActionResult<{ title: string }> = {
			ok: true,
			data: { title: "Hello" },
		};
		if (result.ok) {
			expect(result.data.title).toBe("Hello");
		}
		expect(result.ok).toBe(true);
	});

	it("error result carries error string", () => {
		const result: ActionResult<never> = {
			ok: false,
			error: "Not found",
			code: "not_found",
		};
		if (!result.ok) {
			expect(result.error).toBe("Not found");
			expect(result.code).toBe("not_found");
		}
		expect(result.ok).toBe(false);
	});

	it("error result code is optional", () => {
		const result: ActionResult<string> = {
			ok: false,
			error: "Validation failed",
		};
		if (!result.ok) {
			expect(result.code).toBeUndefined();
		}
	});

	it("discriminant narrows type correctly", () => {
		function getResult(succeed: boolean): ActionResult<number> {
			if (succeed) return { ok: true, data: 42 };
			return { ok: false, error: "Failed" };
		}

		const ok = getResult(true);
		const fail = getResult(false);

		expect(ok.ok).toBe(true);
		if (ok.ok) expect(ok.data).toBe(42);

		expect(fail.ok).toBe(false);
		if (!fail.ok) expect(fail.error).toBe("Failed");
	});
});

// ─── Admin i18n label map ─────────────────────────────────────────────────────

// Derive the locale set from the runtime keys of adminLabels — guarantees
// every locale defined in the source is exercised here. (Previously this
// was a hardcoded en/es/fr/de/pt/ja list which silently skipped te/hi/ny.)
const ALL_LOCALES = Object.keys(adminLabels) as AdminLocale[];

// English is the authoritative key source; every other locale must match.
const EXPECTED_KEYS = Object.keys(adminLabels.en) as AdminLabelKey[];

describe("admin i18n label map", () => {
	it("has at least 30 label keys", () => {
		expect(EXPECTED_KEYS.length).toBeGreaterThanOrEqual(30);
	});

	it("locale set covers every AdminLocale union member", () => {
		// If you add a new locale to the AdminLocale union, this assertion
		// will fail until you also add an entry to the adminLabels map.
		const expected: AdminLocale[] = [
			"en",
			"es",
			"fr",
			"de",
			"pt",
			"ja",
			"te",
			"hi",
			"ny",
		];
		for (const loc of expected) {
			expect(
				ALL_LOCALES,
				`AdminLocale '${loc}' missing from adminLabels`,
			).toContain(loc);
		}
	});

	for (const locale of ALL_LOCALES) {
		it(`locale '${locale}' has all required keys`, () => {
			const localeKeys = new Set(Object.keys(adminLabels[locale]));
			// Report ALL missing keys, not just the first one — early failure
			// hid the true scope of the gap on previous runs (one error said
			// "missing navGroupSite", reality was 37 missing keys).
			const missing = EXPECTED_KEYS.filter((k) => !localeKeys.has(k));
			expect(
				missing,
				`locale '${locale}' missing ${missing.length} key(s): ${missing.join(", ")}`,
			).toEqual([]);
		});

		it(`locale '${locale}' has no empty string values`, () => {
			for (const [key, value] of Object.entries(adminLabels[locale])) {
				expect(value, `locale '${locale}' key '${key}' is empty`).not.toBe("");
			}
		});
	}

	it("required keys include navigation and content action labels", () => {
		const keys = new Set(EXPECTED_KEYS);
		expect(keys.has("navDashboard")).toBe(true);
		expect(keys.has("navPosts")).toBe(true);
		expect(keys.has("navMedia")).toBe(true);
		expect(keys.has("createPost")).toBe(true);
		expect(keys.has("changeLanguage")).toBe(true);
		expect(keys.has("confirmDelete")).toBe(true);
		expect(keys.has("approveComment")).toBe(true);
	});
});
