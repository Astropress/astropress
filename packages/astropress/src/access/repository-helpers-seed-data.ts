// stryker-disable-file: data-only — starter-role seed configuration.
// Pure config: each entry maps to repo.createRole + repo.addRolePolicy
// calls with no logic. The seedStarterRoles consumer in
// repository-helpers.ts is exercised through access-repository.test.ts;
// mutating the action strings or descriptions here would only rename
// the seed (still a valid policy), which is not a behavioral defect.

import type { Condition, Effect } from "./types";

export interface StarterRolePolicySeed {
	effect: Effect;
	action: string;
	priority?: number;
	condition?: Condition;
}

export interface StarterRoleSeed {
	name: string;
	description: string;
	policies: StarterRolePolicySeed[];
}

export const STARTER_ROLE_SEEDS: readonly StarterRoleSeed[] = [
	{
		name: "Editor",
		description:
			"Edits site content (pages, posts, media). Cannot delete published items or manage users / settings. Admins can rename, edit, or delete this role.",
		policies: [
			{ effect: "allow", action: "pages:*" },
			{ effect: "deny", action: "pages:delete", priority: 100 },
			{ effect: "allow", action: "posts:*" },
			{ effect: "deny", action: "posts:delete", priority: 100 },
			{ effect: "allow", action: "media:upload" },
			{ effect: "allow", action: "media:list" },
		],
	},
	{
		name: "Author",
		description:
			"Creates and edits their own posts only. Cannot edit other authors' work, manage taxonomies, or touch site structure. Admins can customize this role.",
		policies: [
			{ effect: "allow", action: "posts:list" },
			{ effect: "allow", action: "posts:create" },
			{
				effect: "allow",
				action: "posts:edit",
				condition: {
					op: "stringEquals",
					left: "resource.ownerId",
					right: "${user.id}",
				},
			},
			{ effect: "allow", action: "media:upload" },
		],
	},
	{
		name: "Moderator",
		description:
			"Moderates comments and audience signals. No content authoring authority. Admins can customize this role.",
		policies: [{ effect: "allow", action: "comments:*" }],
	},
	{
		name: "Translator",
		description:
			"Edits localized strings only. Read-only on everything else. Admins can customize this role.",
		policies: [{ effect: "allow", action: "translations:manage" }],
	},
];
