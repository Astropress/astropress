// ─── Content Modeling ─────────────────────────────────────────────────────────

/**
 * A single field in a content type definition.
 *
 * @example
 * ```ts
 * const titleField: FieldDefinition = {
 *   name: "subtitle",
 *   type: "text",
 *   label: "Subtitle",
 *   required: true,
 *   validate: (value) => value.length <= 120 || "Subtitle must be 120 characters or fewer",
 * };
 * ```
 */
export interface FieldDefinition {
  /** Identifier used as the key in `metadata`. Must be a valid JS identifier. */
  name: string;
  /** Human-readable label for the admin form field. */
  label: string;
  /** Input type. Controls admin form rendering and basic type coercion. */
  type: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "url" | "email";
  /** When true, `saveRuntimeContentState` rejects saves where this field is absent or empty. */
  required?: boolean;
  /** Allowed values for `type: "select"` fields. */
  options?: readonly string[];
  /**
   * Optional server-side validation hook.
   * Return `true` (or a string with no content) to pass.
   * Return a non-empty string to fail with that message.
   *
   * @example
   * ```ts
   * validate: (v) => /^[\w-]+$/.test(v) || "Only letters, numbers, and hyphens are allowed"
   * ```
   */
  validate?: (value: unknown) => true | string;
}

/**
 * A content type definition that associates a `templateKey` with a set of typed field definitions.
 *
 * Field values are stored in the `metadata` JSON column and validated at save time.
 *
 * @example
 * ```ts
 * registerCms({
 *   contentTypes: [
 *     {
 *       key: "event",
 *       label: "Event",
 *       fields: [
 *         { name: "eventDate", label: "Event Date", type: "date", required: true },
 *         { name: "venue", label: "Venue", type: "text" },
 *         {
 *           name: "capacity",
 *           label: "Max Capacity",
 *           type: "number",
 *           validate: (v) => Number(v) > 0 || "Capacity must be a positive number",
 *         },
 *       ],
 *     },
 *   ],
 *   // ...
 * });
 * ```
 */
export interface ContentTypeDefinition {
  /** Must match one of the `templateKeys` registered in `registerCms()`. */
  key: string;
  /** Human-readable name shown in the admin panel content type selector. */
  label: string;
  /** Ordered list of custom field definitions for this content type. */
  fields: readonly FieldDefinition[];
}

/**
 * Validate `metadata` values against the field definitions for a given content type.
 *
 * Returns `null` when all validations pass, or the first validation error message encountered.
 * Called internally by `saveRuntimeContentState` when `contentTypes` are configured.
 */
export function validateContentFields(
  contentType: ContentTypeDefinition,
  metadata: Record<string, unknown>,
): string | null {
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
