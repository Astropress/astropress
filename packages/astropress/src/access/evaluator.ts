/**
 * Pure-function policy evaluator.
 *
 * Algorithm:
 *  1. If subject.isAdmin → allow (break-glass; admins are never denied).
 *  2. Filter policies whose `action` pattern matches the requested action.
 *  3. Evaluate each policy's condition against the binding context.
 *  4. Among matched + condition-satisfied policies:
 *       - any DENY → deny (return the highest-priority deny for the reason)
 *       - else any ALLOW → allow (return the highest-priority allow)
 *       - else → deny by default
 *  5. Reason string is human-readable, suitable for UI tooltips and audit.
 */

import { evaluateCondition } from "./condition-evaluator";
import type { Decision, Env, EvaluationResult, Policy, Resource, Subject } from "./types";

export function actionMatches(pattern: string, requested: string): boolean {
	if (pattern === "*") return true;
	if (pattern === requested) return true;
	if (pattern.endsWith(":*")) {
		const prefix = pattern.slice(0, -1); // keep "namespace:"
		return requested.startsWith(prefix);
	}
	return false;
}

export function evaluate(
	subject: Subject,
	action: string,
	policies: readonly Policy[],
	resource?: Resource,
	env?: Env,
): EvaluationResult {
	if (subject.isAdmin) {
		return {
			decision: "allow",
			reason: "Subject is an Admin — admins bypass policy evaluation.",
		};
	}

	const ctx = { user: subject, resource, env: env ?? { time: nowSeconds() } };
	const matched: Policy[] = [];
	for (const p of policies) {
		if (!actionMatches(p.action, action)) continue;
		if (p.condition && !evaluateCondition(p.condition, ctx)) continue;
		matched.push(p);
	}

	if (matched.length === 0) {
		return {
			decision: "deny",
			reason: `No policy grants ${action}. Default is deny.`,
		};
	}

	const denies = matched.filter((p) => p.effect === "deny");
	if (denies.length > 0) {
		const top = denies.reduce((a, b) => (a.priority >= b.priority ? a : b));
		return {
			decision: "deny" satisfies Decision,
			reason: `Denied by ${describeSource(top)} on ${top.action}.`,
			matchedPolicy: top,
		};
	}

	const allows = matched.filter((p) => p.effect === "allow");
	const top = allows.reduce((a, b) => (a.priority >= b.priority ? a : b));
	return {
		decision: "allow",
		reason: `Allowed by ${describeSource(top)} on ${top.action}.`,
		matchedPolicy: top,
	};
}

function describeSource(p: Policy): string {
	if (p.source.kind === "direct") return "direct grant";
	return `role "${p.source.roleName ?? p.source.roleId ?? "unknown"}"`;
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}
