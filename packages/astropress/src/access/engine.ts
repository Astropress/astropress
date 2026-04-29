/**
 * Default JSON-condition policy engine.
 *
 * Construction:
 *   const engine = createPolicyEngine({ resolvePoliciesForSubject: ... });
 *
 * The engine is intentionally synchronous on the can() call — policies must
 * already be resolved for the subject (typically by a per-request middleware
 * that loads role + direct policies once and caches them on Astro.locals).
 *
 * Swap in a Rego or other implementation by writing your own object that
 * satisfies PolicyEngine; nothing in the call sites cares which engine it is.
 */

import { evaluate } from "./evaluator";
import type {
	Env,
	EvaluationResult,
	Policy,
	PolicyEngine,
	Resource,
	Subject,
} from "./types";

export interface JsonPolicyEngineOptions {
	/**
	 * Synchronous lookup — given a subject, return all policies the engine
	 * should consider. Typically the union of role policies + direct grants.
	 * The middleware that produces this list is the integration point with
	 * the access repository.
	 */
	resolvePoliciesForSubject: (subject: Subject) => readonly Policy[];
}

export function createPolicyEngine(
	options: JsonPolicyEngineOptions,
): PolicyEngine {
	return {
		can(
			subject: Subject,
			action: string,
			resource?: Resource,
			env?: Env,
		): EvaluationResult {
			const policies = options.resolvePoliciesForSubject(subject);
			return evaluate(subject, action, policies, resource, env);
		},
		policiesFor(subject: Subject): readonly Policy[] {
			return options.resolvePoliciesForSubject(subject);
		},
	};
}
