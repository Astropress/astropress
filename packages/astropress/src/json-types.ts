// JSON value types for module boundaries.
//
// `JsonValue` and `JsonObject` are the canonical types for data that flows
// across module / adapter / persistence boundaries as JSON. Use them in
// place of `opaque-bag-of-unknowns` and `unknown[]` whenever the value is
// genuinely structurally JSON: serializable, no functions, no `undefined`,
// no class instances. The named types document intent — readers know they
// can `JSON.stringify(value)` without a type assertion — and forbid the
// non-JSON members `opaque-bag-of-unknowns` would silently allow.
//
// When a value is *not* structurally JSON (e.g. it carries class instances,
// closures, or runtime tokens) prefer a concrete interface or a discriminated
// union over either of these helpers — neither `JsonValue` nor `unknown`
// belongs at a typed module boundary.

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type JsonArray = JsonValue[];
