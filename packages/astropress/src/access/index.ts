/**
 * Astropress access control — public barrel.
 *
 * Import from `@astropress-diy/astropress/access` rather than reaching into
 * subpaths. Plugins call `registerAccessAction()` from their setup.
 */

export {
	_resetAccessActionRegistryForTests,
	getAccessAction,
	listAccessActions,
	registerAccessAction,
} from "./action-registry";
export type { BindingContext } from "./condition-evaluator";
export {
	evaluateCondition,
	resolvePath,
	substituteString,
} from "./condition-evaluator";
export type { JsonPolicyEngineOptions } from "./engine";
export { createPolicyEngine } from "./engine";
export { actionMatches, evaluate } from "./evaluator";
export { createAccessMiddleware } from "./middleware";
export type { RequiresAccessOptions } from "./page-guard";
export { requiresAccess } from "./page-guard";
export type {
	AccessRepository,
	AccessStore,
	RolePolicyRecord,
	RoleRecord,
	UserPolicyRecord,
	UserRoleAssignment,
} from "./repository";
export {
	createAccessRepository,
	seedStarterRoles,
} from "./repository";
export type {
	AccessContext,
	AccessSnapshot,
	LocalAccessStoreSurface,
} from "./request-context";
export { getAccessContext } from "./request-context";
export type {
	ActionDefinition,
	AttributeValue,
	Condition,
	Decision,
	Effect,
	Env,
	EvaluationResult,
	Policy,
	PolicyEngine,
	PolicyLoader,
	PolicySource,
	Resource,
	Subject,
} from "./types";

import "./locals";
