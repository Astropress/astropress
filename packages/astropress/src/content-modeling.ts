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
	/**
	 * Input type. Controls admin form rendering and basic type coercion.
	 *
	 * - `"text"` / `"textarea"` / `"number"` / `"boolean"` / `"date"` / `"select"` / `"url"` / `"email"` — scalar fields
	 * - `"content-ref"` — reference to another content record; value is stored as the target's slug string
	 * - `"repeater"` — array of nested objects; schema defined by the `fields` property
	 */
	type:
		| "text"
		| "textarea"
		| "number"
		| "boolean"
		| "date"
		| "select"
		| "url"
		| "email"
		| "content-ref"
		| "repeater";
	/** When true, `saveRuntimeContentState` rejects saves where this field is absent or empty. */
	required?: boolean;
	/** Allowed values for `type: "select"` fields. */
	options?: readonly string[];
	/**
	 * For `type: "content-ref"`: optional filter limiting selectable records to a specific content kind.
	 * When omitted, all content kinds are selectable.
	 */
	refKind?: "post" | "page";
	/**
	 * For `type: "repeater"`: field definitions for each item in the repeater array.
	 * Each array item is validated against these nested field definitions.
	 */
	fields?: readonly FieldDefinition[];
	/**
	 * Conditional visibility rule for the admin form UI.
	 * The field is only shown when another field in the same content type has the given value.
	 * Purely informational — server-side validation is unaffected by this property.
	 *
	 * @example
	 * ```ts
	 * { conditionalOn: { field: "showCallout", equals: true } }
	 * ```
	 */
	conditionalOn?: {
		field: string;
		equals: unknown;
	};
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
						const item = value[i] as Record<string, unknown>;
						if (typeof item !== "object" || item === null) {
							return `"${field.label}" item ${i + 1} must be an object.`;
						}
						const nestedKey = `${field.name}[${i}]`;
						const nestedError = validateContentFields(
							{ key: nestedKey, label: field.label, fields: field.fields },
							item,
						);
						if (nestedError) {
							return `${nestedKey}: ${nestedError}`;
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
