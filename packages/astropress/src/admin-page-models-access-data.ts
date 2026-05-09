// stryker-disable-file: data-only — static catalog of access-page tab keys, the empty-model template returned on forbidden, and the user-facing fallback warning strings used by buildAccessPageModel. No runtime branching; behavioural mutants live in admin-page-models-access.ts and are exercised by its tests.

import type { Policy, RolePolicyRecord, RoleRecord } from "./access/index";
import type { ManagedAdminUser } from "./persistence-types";

export type AccessPageTab = "users" | "roles" | "my-permissions";

export interface AccessPageModel {
	activeTab: AccessPageTab;
	users: ManagedAdminUser[];
	roles: RoleRecord[];
	userRoleMap: Record<number, string[]>;
	userDirectGrantCounts: Record<number, number>;
	rolePoliciesMap: Record<string, RolePolicyRecord[]>;
	activeAdminCount: number;
	viewerPolicies: readonly Policy[];
}

export const ACCESS_PAGE_TABS: readonly AccessPageTab[] = ["users", "roles", "my-permissions"];

export const ACCESS_PAGE_EMPTY_MODEL: AccessPageModel = {
	activeTab: "users",
	users: [],
	roles: [],
	userRoleMap: {},
	userDirectGrantCounts: {},
	rolePoliciesMap: {},
	activeAdminCount: 0,
	viewerPolicies: [],
};

export const ACCESS_PAGE_USERS_UNAVAILABLE_WARNING = "User records are temporarily unavailable.";
export const ACCESS_PAGE_TAB_DATA_UNAVAILABLE_WARNING =
	"Access role and grant data is temporarily unavailable.";
