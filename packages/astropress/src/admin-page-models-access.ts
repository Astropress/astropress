// ─── /ap-admin/access page model — three-tab Access page ────────────────────
// Tabs: Users / Roles / My Permissions.
//
// All tabs share a single async builder so the .astro shell can flip the
// active tab from `?tab=` without refetching unrelated data. The Users tab
// is the default.

import type { APIContext } from "astro";
import { loadAccessTabDataFromD1 } from "./access/d1-access-page-store";
import type { RolePolicyRecord, RoleRecord } from "./access/index";
import { getAccessContext } from "./access/index";
import { type AdminPageResult, forbidden, ok, withFallback } from "./admin-page-model-helpers";
import {
	ACCESS_PAGE_EMPTY_MODEL,
	ACCESS_PAGE_TAB_DATA_UNAVAILABLE_WARNING,
	ACCESS_PAGE_TABS,
	ACCESS_PAGE_USERS_UNAVAILABLE_WARNING,
	type AccessPageModel,
	type AccessPageTab,
} from "./admin-page-models-access-data";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import type { AuthUser } from "./platform-contracts";
import { isAuthUserAdmin } from "./platform-contracts";
import { getRuntimeAdminUsers } from "./runtime-page-store";

export type { AccessPageModel, AccessPageTab };

function normaliseTab(input: string | null | undefined): AccessPageTab {
	if (!input) return "users";
	return ACCESS_PAGE_TABS.includes(input as AccessPageTab) ? (input as AccessPageTab) : "users";
}

export async function buildAccessPageModel(
	locals: APIContext["locals"],
	user: AuthUser | null | undefined,
	options: { tab?: AccessPageTab } = {},
): Promise<AdminPageResult<AccessPageModel>> {
	if (!user || !isAuthUserAdmin(user)) return forbidden(ACCESS_PAGE_EMPTY_MODEL);

	const activeTab = normaliseTab(options.tab);
	const warnings: string[] = [];

	const users = await withFallback(
		warnings,
		ACCESS_PAGE_USERS_UNAVAILABLE_WARNING,
		() => getRuntimeAdminUsers(locals),
		[],
	);

	const tabData = await withFallback(
		warnings,
		ACCESS_PAGE_TAB_DATA_UNAVAILABLE_WARNING,
		() => loadAccessTabData(locals),
		{
			roles: [] as RoleRecord[],
			userRoleMap: {},
			userDirectGrantCounts: {},
			rolePoliciesMap: {} as Record<string, RolePolicyRecord[]>,
			activeAdminCount: 0,
		},
	);

	const viewerAccess = await getAccessContext({ locals } as {
		locals: App.Locals;
	});
	const viewerPolicies = viewerAccess?.engine.policiesFor(viewerAccess.subject) ?? [];

	return ok(
		{
			activeTab,
			users,
			roles: tabData.roles,
			userRoleMap: tabData.userRoleMap,
			userDirectGrantCounts: tabData.userDirectGrantCounts,
			rolePoliciesMap: tabData.rolePoliciesMap,
			activeAdminCount: tabData.activeAdminCount,
			viewerPolicies,
		},
		warnings,
	);
}

async function loadAccessTabData(locals: App.Locals) {
	return withLocalStoreFallback(
		locals,
		async (db) => loadAccessTabDataFromD1(db),
		async () => ({
			roles: [],
			userRoleMap: {},
			userDirectGrantCounts: {},
			rolePoliciesMap: {},
			activeAdminCount: 0,
		}),
	);
}
