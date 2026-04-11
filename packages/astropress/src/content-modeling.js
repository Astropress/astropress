/**
 * Validate metadata values against the field definitions for a given content type.
 * Returns null when all validations pass, or the first validation error message.
 * @param {import("./content-modeling.ts").ContentTypeDefinition} contentType
 * @param {Record<string, unknown>} metadata
 * @returns {string | null}
 */
export function validateContentFields(contentType, metadata) {
  for (const field of contentType.fields) {
    const value = metadata[field.name];
    const isEmpty = value === undefined || value === null || value === "";
    if (field.required && isEmpty) {
      return `"${field.label}" is required.`;
    }
    if (!isEmpty && typeof field.validate === "function") {
      const result = field.validate(value);
      if (result !== true && result) {
        return result;
      }
    }
  }
  return null;
}
