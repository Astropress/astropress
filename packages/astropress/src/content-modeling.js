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

    if (!isEmpty) {
      if (field.type === "content-ref" && typeof value !== "string") {
        return `"${field.label}" must be a content slug string.`;
      }

      if (field.type === "repeater") {
        if (!Array.isArray(value)) {
          return `"${field.label}" must be an array.`;
        }
        if (field.fields) {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (typeof item !== "object" || item === null) {
              return `"${field.label}" item ${i + 1} must be an object.`;
            }
            const nestedError = validateContentFields(
              { key: `${field.name}[${i}]`, label: field.label, fields: field.fields },
              item,
            );
            if (nestedError) {
              return nestedError;
            }
          }
        }
      }

      if (typeof field.validate === "function") {
        const result = field.validate(value);
        if (result !== true && result) {
          return result;
        }
      }
    }
  }
  return null;
}
