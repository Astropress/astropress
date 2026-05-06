import { describe, expect, it, vi } from "vitest";
import type { Actor } from "../src/persistence-types";
import { createAstropressTranslationRepository } from "../src/translation-repository-factory";

const actor: Actor = {
	email: "editor@example.com",
	role: "editor",
	name: "Editor Example",
};

describe("createAstropressTranslationRepository", () => {
	it("rejects invalid translation states", () => {
		const repository = createAstropressTranslationRepository({
			readTranslationState: vi.fn(),
			persistTranslationState: vi.fn(),
			recordTranslationAudit: vi.fn(),
		});

		expect(repository.updateTranslationState("/about", "wrong", actor)).toEqual({
			ok: false,
			error:
				"Invalid translation state. Must be one of: not_started, partial, fallback_en, translated, reviewed, published",
		});
	});

	it("persists a valid translation state and records audit data", () => {
		const persistTranslationState = vi.fn();
		const recordTranslationAudit = vi.fn();
		const repository = createAstropressTranslationRepository({
			readTranslationState: vi.fn(),
			persistTranslationState,
			recordTranslationAudit,
		});

		expect(repository.updateTranslationState("/about", "published", actor)).toEqual({ ok: true });
		expect(persistTranslationState).toHaveBeenCalledWith("/about", "published", actor);
		expect(recordTranslationAudit).toHaveBeenCalledWith({
			actor,
			route: "/about",
			state: "published",
		});
	});

	it("falls back when no translation override exists", () => {
		const repository = createAstropressTranslationRepository({
			readTranslationState: vi.fn(() => null),
			persistTranslationState: vi.fn(),
			recordTranslationAudit: vi.fn(),
		});

		expect(repository.getEffectiveTranslationState("/about", "reviewed")).toBe("reviewed");
	});

	it("normalizes the stored translation state", () => {
		const repository = createAstropressTranslationRepository({
			readTranslationState: vi.fn(() => "PUBLISHED"),
			persistTranslationState: vi.fn(),
			recordTranslationAudit: vi.fn(),
		});

		expect(repository.getEffectiveTranslationState("/about")).toBe("published");
	});

	it("uses 'not_started' as the default fallback when caller omits the fallback arg", () => {
		// Pins the default-arg StringLiteral: omit fallback, ensure stored value
		// missing → returns "not_started".
		const repository = createAstropressTranslationRepository({
			readTranslationState: vi.fn(() => null),
			persistTranslationState: vi.fn(),
			recordTranslationAudit: vi.fn(),
		});
		expect(repository.getEffectiveTranslationState("/about")).toBe("not_started");
	});
});
