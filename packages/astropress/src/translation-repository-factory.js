import { normalizeTranslationState, translationStates } from "./translation-state.js";

export function createAstropressTranslationRepository(input) {
  return {
    updateTranslationState(route, state, actor) {
      const normalizedState = normalizeTranslationState(state, "__invalid__");
      if (!translationStates.includes(normalizedState)) {
        return { ok: false, error: `Invalid translation state. Must be one of: ${translationStates.join(", ")}` };
      }

      input.persistTranslationState(route, normalizedState, actor);
      input.recordTranslationAudit({
        actor,
        route,
        state: normalizedState,
      });

      return { ok: true };
    },
    getEffectiveTranslationState(route, fallback = "not_started") {
      return normalizeTranslationState(input.readTranslationState(route), normalizeTranslationState(fallback));
    },
  };
}
