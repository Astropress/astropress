export const translationStates = [
  "not_started",
  "in_progress",
  "review",
  "published",
];

export function normalizeTranslationState(value, fallback = "not_started") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (translationStates.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

export function isPublishedTranslationState(value) {
  return normalizeTranslationState(value) === "published";
}
