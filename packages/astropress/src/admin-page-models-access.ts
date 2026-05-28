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
	if (!user) return forbidden(ACCESS_PAGE_EMPTY_MODEL);

	const viewerAccess = await getAccessContext({ locals } as {
		locals: App.Locals;
	});
	// The page-level guard is `users:list`; the model mirrors it so a partial
	// permission viewer (a custom non-admin role holding only `users:list`) is
	// served instead of falsely forbidden. When no access engine is wired
	// (older consumers / harness with no session on locals) we fall back to the
	// legacy admin flag so the page stays usable. Admins bypass policy
	// evaluation, so every `can()` below resolves to allow for them.
	const canListUsers = viewerAccess
		? viewerAccess.can("users:list").decision === "allow"
		: isAuthUserAdmin(user);
	if (!canListUsers) return forbidden(ACCESS_PAGE_EMPTY_MODEL);

	const activeTab = normaliseTab(options.tab);
	const warnings: string[] = [];

	const users = await withFallback(
		warnings,
		ACCESS_PAGE_USERS_UNAVAILABLE_WARNING,
		() => getRuntimeAdminUsers(locals),
		[],
	);

	const viewerPolicies = viewerAccess?.engine.policiesFor(viewerAccess.subject) ?? [];
	// "My permissions" always renders; the role/grant management surfaces are
	// loaded ONLY for viewers who hold the matching action. We resolve those
	// decisions through the same policy engine that gates the action routes,
	// so the page can never display data the viewer is not entitled to manage.
	// The no-engine fallback grants both to a legacy admin so existing installs
	// keep their full Access page until they wire the access store.
	const canManageRoles = viewerAccess
		? viewerAccess.can("roles:manage").decision === "allow"
		: isAuthUserAdmin(user);
	const canManageGrants = viewerAccess
		? viewerAccess.can("grants:manage").decision === "allow"
		: isAuthUserAdmin(user);

	const emptyTabData = {
		roles: [] as RoleRecord[],
		userRoleMap: {} as Record<number, string[]>,
		userDirectGrantCounts: {} as Record<number, number>,
		rolePoliciesMap: {} as Record<string, RolePolicyRecord[]>,
		activeAdminCount: 0,
	};
	const tabData =
		canManageRoles || canManageGrants
			? await withFallback(
					warnings,
					ACCESS_PAGE_TAB_DATA_UNAVAILABLE_WARNING,
					() => loadAccessTabData(locals),
					emptyTabData,
				)
			: emptyTabData;

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
			canManageRoles,
			canManageGrants,
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
