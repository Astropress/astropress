/**
 * Astropress access control — public barrel.
 *
 * Import from `@astropress-diy/astropress/access` rather than reaching into
 * subpaths. Plugins call `registerAccessAction()` from their setup.
 */

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
export { actionMatches, evaluate } from "./evaluator";
export {
	evaluateCondition,
	resolvePath,
	substituteString,
} from "./condition-evaluator";
export type { BindingContext } from "./condition-evaluator";
export {
	getAccessAction,
	listAccessActions,
	registerAccessAction,
	_resetAccessActionRegistryForTests,
} from "./action-registry";
export { createPolicyEngine } from "./engine";
export type { JsonPolicyEngineOptions } from "./engine";
export {
	createAccessRepository,
	seedStarterRoles,
} from "./repository";
export type {
	AccessRepository,
	AccessStore,
	RolePolicyRecord,
	RoleRecord,
	UserPolicyRecord,
	UserRoleAssignment,
} from "./repository";
export { getAccessContext } from "./request-context";
export type {
	AccessContext,
	AccessSnapshot,
	LocalAccessStoreSurface,
} from "./request-context";
export { createAccessMiddleware } from "./middleware";
export { requiresAccess } from "./page-guard";
export type { RequiresAccessOptions } from "./page-guard";
import "./locals";
