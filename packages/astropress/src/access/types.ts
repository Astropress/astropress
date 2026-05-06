/**
 * Core types for the Astropress access control system.
 *
 * Model: attribute-based access control (ABAC) with role bundles plus optional
 * direct user grants. The single hardcoded role is "Admin" (subject.isAdmin) —
 * admins bypass policy evaluation entirely so the system is always recoverable.
 * Every other role is user-defined; the engine has no opinion about names.
 *
 * Policies are JSON condition blocks (AWS-IAM-style). DENY beats ALLOW; default
 * is deny. The PolicyEngine interface lets a Rego or other implementation plug
 * in later without changing call sites.
 */

export type Effect = "allow" | "deny";
export type Decision = "allow" | "deny";

export type AttributeValue =
	| string
	| number
	| boolean
	| null
	| readonly string[]
	| readonly number[];

export interface Subject {
	id: string;
	email: string;
	isAdmin: boolean;
	/** Role IDs this user holds. Order is not significant. */
	roles: readonly string[];
	/** Arbitrary key/value attributes — team, region, language, MFA tier, etc. */
	attributes: Readonly<Record<string, AttributeValue>>;
}

export interface Resource {
	type: string;
	id?: string;
	ownerId?: string;
	tags?: readonly string[];
	attributes?: Readonly<Record<string, AttributeValue>>;
}

export interface Env {
	ip?: string;
	sessionAge?: number;
	mfaUsed?: boolean;
	/** Unix epoch seconds. Defaults to Date.now()/1000 in the evaluator. */
	time?: number;
}

/**
 * Condition tree. The engine recurses through these nodes against a binding
 * context that exposes `user.*`, `resource.*`, and `env.*` attribute paths.
 * String values may contain `${user.id}` etc. — see condition-evaluator.ts.
 */
export type Condition =
	| { op: "stringEquals"; left: string; right: string }
	| { op: "stringIn"; left: string; right: readonly string[] }
	| { op: "stringStartsWith"; left: string; right: string }
	| { op: "numberLessThan"; left: string; right: number }
	| { op: "numberGreaterThan"; left: string; right: number }
	| { op: "bool"; left: string; right: boolean }
	| { op: "attributeExists"; left: string }
	| { op: "not"; condition: Condition }
	| { op: "anyOf"; conditions: readonly Condition[] }
	| { op: "allOf"; conditions: readonly Condition[] };

export interface PolicySource {
	kind: "role" | "direct";
	roleId?: string;
	roleName?: string;
}

export interface Policy {
	id: string;
	effect: Effect;
	/**
	 * Action pattern: exact match (`posts:edit`), namespace wildcard
	 * (`posts:*`), or full wildcard (`*`). Anchored at start.
	 */
	action: string;
	condition?: Condition;
	/**
	 * Higher priority policies are checked first within their effect tier.
	 * DENY beats ALLOW regardless of priority. Use priority for ordering
	 * matched-explanation reasons, not for safety.
	 */
	priority: number;
	source: PolicySource;
}

export interface EvaluationResult {
	decision: Decision;
	/** Human-readable reason — shown in UI tooltips and logged in audit. */
	reason: string;
	matchedPolicy?: Policy;
}

export interface ActionDefinition {
	id: string;
	description: string;
	/** Optional resource kind this action operates on — drives the role builder UI. */
	resourceKind?: string;
	/** Optional sub-scopes for fine-grained pickers (e.g. ["own", "any"]). */
	scopes?: readonly string[];
	/** ID of the plugin that registered this action. Built-ins use "core". */
	pluginId: string;
}

export interface PolicyEngine {
	can(subject: Subject, action: string, resource?: Resource, env?: Env): EvaluationResult;
	/** Return the full set of policies the engine would evaluate for a subject. */
	policiesFor(subject: Subject): readonly Policy[];
}

/** Loader used by the default JSON engine — returned policies must be DB-resolved. */
export type PolicyLoader = (subject: Subject) => Promise<readonly Policy[]>;
