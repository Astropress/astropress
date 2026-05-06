import type { Actor, TranslationRepository } from "./persistence-types";
import {
	normalizeTranslationState,
	type TranslationState,
	translationStates,
} from "./translation-state";

export interface AstropressTranslationRepositoryInput {
	readTranslationState(route: string): string | null | undefined;
	persistTranslationState(route: string, state: TranslationState, actor: Actor): void;
	recordTranslationAudit(input: { actor: Actor; route: string; state: TranslationState }): void;
}

export function createAstropressTranslationRepository(
	input: AstropressTranslationRepositoryInput,
): TranslationRepository {
	return {
		updateTranslationState(route, state, actor) {
			const normalizedState = normalizeTranslationState(state, "__invalid__" as TranslationState);
			if (!(translationStates as readonly string[]).includes(normalizedState)) {
				return {
					ok: false as const,
					error: `Invalid translation state. Must be one of: ${translationStates.join(", ")}`,
				};
			}

			input.persistTranslationState(route, normalizedState, actor);
			input.recordTranslationAudit({
				actor,
				route,
				state: normalizedState,
			});

			return { ok: true as const };
		},
		getEffectiveTranslationState(route, fallback) {
			// normalizeTranslationState's own fallback is "not_started"; pass
			// the caller-supplied fallback through only if provided, otherwise
			// let normalize use its default to avoid an equivalent default-arg
			// string literal.
			const normalized = fallback === undefined ? undefined : normalizeTranslationState(fallback);
			return normalizeTranslationState(input.readTranslationState(route), normalized);
		},
	};
}
