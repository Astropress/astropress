// ─── /ap-admin/access page model — three-tab Access page ────────────────────
// Tabs: Users / Roles / My Permissions.
//
// All tabs share a single async builder so the .astro shell can flip the
// active tab from `?tab=` without refetching unrelated data. The Users tab
// is the default.

import type { APIContext } from "astro";
import { loadAccessTabDataFromD1 } from "./access/d1-access-page-store";
import { getAccessContext } from "./access/index";
import type { Policy, RoleRecord } from "./access/index";
import {
	type AdminPageResult,
	forbidden,
	ok,
	withFallback,
} from "./admin-page-model-helpers";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import type { ManagedAdminUser } from "./persistence-types";
import { isAuthUserAdmin } from "./platform-contracts";
import type { AuthUser } from "./platform-contracts";
import { getRuntimeAdminUsers } from "./runtime-page-store";

export type AccessPageTab = "users" | "roles" | "my-permissions";

export interface AccessPageModel {
	activeTab: AccessPageTab;
	users: ManagedAdminUser[];
	roles: RoleRecord[];
	userRoleMap: Record<number, string[]>;
	userDirectGrantCounts: Record<number, number>;
	activeAdminCount: number;
	viewerPolicies: readonly Policy[];
}

const TABS: readonly AccessPageTab[] = ["users", "roles", "my-permissions"];

function normaliseTab(input: string | null | undefined): AccessPageTab {
	if (!input) return "users";
	return TABS.includes(input as AccessPageTab)
		? (input as AccessPageTab)
		: "users";
}

const EMPTY_MODEL: AccessPageModel = {
	activeTab: "users",
	users: [],
	roles: [],
	userRoleMap: {},
	userDirectGrantCounts: {},
	activeAdminCount: 0,
	viewerPolicies: [],
};

export async function buildAccessPageModel(
	locals: APIContext["locals"],
	user: AuthUser | null | undefined,
	options: { tab?: AccessPageTab } = {},
): Promise<AdminPageResult<AccessPageModel>> {
	if (!user || !isAuthUserAdmin(user)) return forbidden(EMPTY_MODEL);

	const activeTab = normaliseTab(options.tab);
	const warnings: string[] = [];

	const users = await withFallback(
		warnings,
		"User records are temporarily unavailable.",
		() => getRuntimeAdminUsers(locals),
		[],
	);

	const tabData = await withFallback(
		warnings,
		"Access role and grant data is temporarily unavailable.",
		() => loadAccessTabData(locals),
		{
			roles: [] as RoleRecord[],
			userRoleMap: {},
			userDirectGrantCounts: {},
			activeAdminCount: 0,
		},
	);

	const viewerAccess = await getAccessContext({ locals } as {
		locals: App.Locals;
	});
	const viewerPolicies =
		viewerAccess?.engine.policiesFor(viewerAccess.subject) ?? [];

	return ok(
		{
			activeTab,
			users,
			roles: tabData.roles,
			userRoleMap: tabData.userRoleMap,
			userDirectGrantCounts: tabData.userDirectGrantCounts,
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
			activeAdminCount: 0,
		}),
	);
}
