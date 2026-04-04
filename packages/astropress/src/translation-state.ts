export const translationStates = [
  "not_started",
  "partial",
  "fallback_en",
  "translated",
  "reviewed",
  "published",
] as const;

export type TranslationState = (typeof translationStates)[number];

const legacyStateMap: Record<string, TranslationState> = {
  original: "not_started",
  "in-progress": "partial",
  "pending-review": "translated",
  approved: "reviewed",
  "needs-revision": "partial",
  archived: "fallback_en",
  complete: "published",
};

export function normalizeTranslationState(value: string | null | undefined, fallback: TranslationState = "not_started"): TranslationState {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if ((translationStates as readonly string[]).includes(normalized)) {
    return normalized as TranslationState;
  }

  return legacyStateMap[normalized] ?? fallback;
}

export function isPublishedTranslationState(value: string | null | undefined) {
  return normalizeTranslationState(value) === "published";
}
