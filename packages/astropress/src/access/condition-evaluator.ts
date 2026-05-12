/**
 * Pure-function condition evaluator and binding-context resolver.
 *
 * Conditions reference attributes via dotted paths against three roots:
 *   - user.*      — every Subject field, including user.attributes.<key>
 *   - resource.*  — every Resource field, including resource.attributes.<key>
 *   - env.*       — every Env field
 *
 * String operands may contain ${path} substitutions resolved from the same
 * binding context; this lets a policy say `resource.ownerId === ${user.id}`
 * for the classic "owner can edit" pattern without bespoke conditions.
 */

import type { AttributeValue, Condition, Env, Resource, Subject } from "./types";

export interface BindingContext {
	user: Subject;
	resource?: Resource;
	env?: Env;
}

/**
 * Resolve a dotted path against the binding context.
 * Returns `undefined` when any segment is missing — the caller decides whether
 * that should fail the condition (default: yes).
 */
export function resolvePath(path: string, ctx: BindingContext): AttributeValue | undefined {
	const parts = path.split(".");
	const root = parts[0];
	if (root === "user") return walk(parts.slice(1), ctx.user);
	if (root === "resource") return ctx.resource ? walk(parts.slice(1), ctx.resource) : undefined;
	if (root === "env") return ctx.env ? walk(parts.slice(1), ctx.env) : undefined;
	return undefined;
}

function walk(parts: readonly string[], root: object | undefined): AttributeValue | undefined {
	let cur: unknown = root;
	for (const p of parts) {
		if (cur === null || cur === undefined) return undefined;
		if (typeof cur !== "object") return undefined;
		// audit-boundary: opaque-passthrough -- module-boundary value; narrowed at consumer
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur as AttributeValue | undefined;
}

const SUB_RE = /\$\{([a-zA-Z0-9_.]+)\}/g;

/** Substitute ${path} occurrences inside a string literal. */
export function substituteString(src: string, ctx: BindingContext): string {
	return src.replace(SUB_RE, (_, path: string) => {
		const v = resolvePath(path, ctx);
		if (v === undefined || v === null) return "";
		return String(v);
	});
}

// Single defensive guard used by every leaf operator. resolvePath returns
// undefined for missing/null traversal; the leaf semantics are "missing
// attribute on the left fails the condition." Centralising this keeps the
// mutation surface to one site instead of one per operator.
function present(left: AttributeValue | undefined): boolean {
	return left !== undefined && left !== null;
}

/** Evaluate a condition tree. Missing-attribute on the left fails the leaf. */
export function evaluateCondition(c: Condition, ctx: BindingContext): boolean {
	switch (c.op) {
		case "stringEquals": {
			const left = resolvePath(c.left, ctx);
			if (!present(left)) return false;
			return String(left) === substituteString(c.right, ctx);
		}
		case "stringIn": {
			const left = resolvePath(c.left, ctx);
			if (!present(left)) return false;
			const target = String(left);
			return c.right.some((r) => substituteString(r, ctx) === target);
		}
		case "stringStartsWith": {
			const left = resolvePath(c.left, ctx);
			if (!present(left)) return false;
			return String(left).startsWith(substituteString(c.right, ctx));
		}
		case "numberLessThan": {
			const left = resolvePath(c.left, ctx);
			if (typeof left !== "number") return false;
			return left < c.right;
		}
		case "numberGreaterThan": {
			const left = resolvePath(c.left, ctx);
			if (typeof left !== "number") return false;
			return left > c.right;
		}
		case "bool":
			return resolvePath(c.left, ctx) === c.right;
		case "attributeExists":
			return present(resolvePath(c.left, ctx));
		case "not":
			return !evaluateCondition(c.condition, ctx);
		case "anyOf":
			return c.conditions.some((sub) => evaluateCondition(sub, ctx));
		case "allOf":
			return c.conditions.every((sub) => evaluateCondition(sub, ctx));
	}
}
