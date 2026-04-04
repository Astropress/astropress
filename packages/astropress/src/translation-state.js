export const translationStates = [
  "not_started",
  "partial",
  "fallback_en",
  "translated",
  "reviewed",
  "published",
];

const legacyStateMap = {
  original: "not_started",
  "in-progress": "partial",
  "pending-review": "translated",
  approved: "reviewed",
  "needs-revision": "partial",
  archived: "fallback_en",
  complete: "published",
};

export function normalizeTranslationState(value, fallback = "not_started") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (translationStates.includes(normalized)) {
    return normalized;
  }
  return legacyStateMap[normalized] ?? fallback;
}

export function isPublishedTranslationState(value) {
  return normalizeTranslationState(value) === "published";
}
