import { describe, expect, it } from "vitest";

import {
	isPublishedTranslationState,
	normalizeTranslationState,
	translationStates,
} from "../src/translation-state";

describe("translationStates manifest", () => {
	it("exposes the canonical 6-state vocabulary", () => {
		expect(translationStates).toEqual([
			"not_started",
			"partial",
			"fallback_en",
			"translated",
			"reviewed",
			"published",
		]);
	});
});

describe("normalizeTranslationState", () => {
	it("returns the provided fallback when value is null", () => {
		expect(normalizeTranslationState(null)).toBe("not_started");
		expect(normalizeTranslationState(null, "published")).toBe("published");
	});

	it("returns the provided fallback when value is undefined", () => {
		expect(normalizeTranslationState(undefined)).toBe("not_started");
		expect(normalizeTranslationState(undefined, "reviewed")).toBe("reviewed");
	});

	it("returns the provided fallback when value is empty string", () => {
		expect(normalizeTranslationState("")).toBe("not_started");
		expect(normalizeTranslationState("", "translated")).toBe("translated");
	});

	it("returns the same canonical state when input already matches", () => {
		for (const s of translationStates) {
			expect(normalizeTranslationState(s)).toBe(s);
		}
	});

	it("trims surrounding whitespace before matching", () => {
		expect(normalizeTranslationState("  published  ")).toBe("published");
	});

	it("lowercases input before matching", () => {
		expect(normalizeTranslationState("Published")).toBe("published");
		expect(normalizeTranslationState("PARTIAL")).toBe("partial");
	});

	it("maps each known legacy alias to its canonical state", () => {
		expect(normalizeTranslationState("original")).toBe("not_started");
		expect(normalizeTranslationState("in-progress")).toBe("partial");
		expect(normalizeTranslationState("pending-review")).toBe("translated");
		expect(normalizeTranslationState("approved")).toBe("reviewed");
		expect(normalizeTranslationState("needs-revision")).toBe("partial");
		expect(normalizeTranslationState("archived")).toBe("fallback_en");
		expect(normalizeTranslationState("complete")).toBe("published");
	});

	it("falls back when the value is neither canonical nor a legacy alias", () => {
		expect(normalizeTranslationState("unknown")).toBe("not_started");
		expect(normalizeTranslationState("unknown", "reviewed")).toBe("reviewed");
	});
});

describe("isPublishedTranslationState", () => {
	it("returns true for the canonical 'published' state", () => {
		expect(isPublishedTranslationState("published")).toBe(true);
	});

	it("returns true for the legacy 'complete' alias", () => {
		expect(isPublishedTranslationState("complete")).toBe(true);
	});

	it("returns false for any other canonical state", () => {
		for (const s of translationStates) {
			if (s === "published") continue;
			expect(isPublishedTranslationState(s)).toBe(false);
		}
	});

	it("returns false for null/undefined/empty inputs", () => {
		expect(isPublishedTranslationState(null)).toBe(false);
		expect(isPublishedTranslationState(undefined)).toBe(false);
		expect(isPublishedTranslationState("")).toBe(false);
	});
});
