// stryker-disable-file: data-only — static catalogue of built-in access actions; data-only.
/**
 * Static catalogue of built-in access actions.
 *
 * Split from action-registry.ts so the pure-data manifest is not
 * mutation-tested: each entry is a top-level static mutant whose value
 * (id strings, descriptions, resourceKind tags) only restates the typed
 * shape. Behavioural surface — register / get / list, and the duplicate-id
 * guard — lives in action-registry.ts and is mutation-tested there.
 */

import type { ActionDefinition } from "./types";

export const BUILT_IN_ACCESS_ACTIONS: readonly ActionDefinition[] = [
	// Site
	{
		id: "pages:list",
		description: "View the pages list",
		resourceKind: "page",
		pluginId: "core",
	},
	{
		id: "pages:create",
		description: "Create a new page",
		resourceKind: "page",
		pluginId: "core",
	},
	{
		id: "pages:edit",
		description: "Edit an existing page",
		resourceKind: "page",
		scopes: ["own", "any"],
		pluginId: "core",
	},
	{
		id: "pages:delete",
		description: "Delete a page",
		resourceKind: "page",
		scopes: ["own", "any"],
		pluginId: "core",
	},
	{
		id: "pages:publish",
		description: "Publish or unpublish a page",
		resourceKind: "page",
		pluginId: "core",
	},
	{
		id: "routePages:edit",
		description: "Edit a route page",
		resourceKind: "routePage",
		pluginId: "core",
	},
	{
		id: "archives:edit",
		description: "Edit archive metadata",
		resourceKind: "archive",
		pluginId: "core",
	},
	{
		id: "media:list",
		description: "View media library",
		resourceKind: "media",
		pluginId: "core",
	},
	{
		id: "media:upload",
		description: "Upload media",
		resourceKind: "media",
		pluginId: "core",
	},
	{
		id: "media:delete",
		description: "Delete media",
		resourceKind: "media",
		scopes: ["own", "any"],
		pluginId: "core",
	},
	{
		id: "redirects:manage",
		description: "Create / edit / delete redirects",
		resourceKind: "redirect",
		pluginId: "core",
	},
	{
		id: "forms:view",
		description: "View form submissions",
		resourceKind: "form",
		pluginId: "core",
	},

	// Content
	{
		id: "posts:list",
		description: "View the posts list",
		resourceKind: "post",
		pluginId: "core",
	},
	{
		id: "posts:create",
		description: "Create a new post",
		resourceKind: "post",
		pluginId: "core",
	},
	{
		id: "posts:edit",
		description: "Edit an existing post",
		resourceKind: "post",
		scopes: ["own", "any"],
		pluginId: "core",
	},
	{
		id: "posts:delete",
		description: "Delete a post",
		resourceKind: "post",
		scopes: ["own", "any"],
		pluginId: "core",
	},
	{
		id: "posts:publish",
		description: "Publish or unpublish a post",
		resourceKind: "post",
		pluginId: "core",
	},
	{
		id: "authors:manage",
		description: "Create / edit author profiles",
		resourceKind: "author",
		pluginId: "core",
	},
	{
		id: "taxonomies:manage",
		description: "Manage categories and tags",
		resourceKind: "taxonomy",
		pluginId: "core",
	},

	// Audience
	{
		id: "subscribers:view",
		description: "View newsletter subscribers",
		resourceKind: "subscriber",
		pluginId: "core",
	},
	{
		id: "subscribers:export",
		description: "Export subscribers",
		resourceKind: "subscriber",
		pluginId: "core",
	},
	{
		id: "newsletter:send",
		description: "Send newsletter campaigns",
		resourceKind: "newsletter",
		pluginId: "core",
	},
	{
		id: "comments:moderate",
		description: "Approve or reject comments",
		resourceKind: "comment",
		pluginId: "core",
	},
	{
		id: "comments:delete",
		description: "Delete comments",
		resourceKind: "comment",
		pluginId: "core",
	},
	{
		id: "events:manage",
		description: "Manage events",
		resourceKind: "event",
		pluginId: "core",
	},
	{
		id: "testimonials:manage",
		description: "Manage testimonials",
		resourceKind: "testimonial",
		pluginId: "core",
	},
	{
		id: "fundraising:manage",
		description: "Manage fundraising campaigns",
		resourceKind: "campaign",
		pluginId: "core",
	},

	// Discoverability
	{ id: "seo:edit", description: "Edit SEO settings", pluginId: "core" },
	{
		id: "translations:manage",
		description: "Manage translation strings",
		pluginId: "core",
	},
	{ id: "sitemaps:view", description: "View sitemap status", pluginId: "core" },

	// Integrations
	{
		id: "services:manage",
		description: "Manage service integrations",
		pluginId: "core",
	},
	{
		id: "apiTokens:create",
		description: "Create API tokens",
		pluginId: "core",
	},
	{
		id: "apiTokens:revoke",
		description: "Revoke API tokens",
		pluginId: "core",
	},
	{
		id: "webhooks:manage",
		description: "Manage outgoing webhooks",
		pluginId: "core",
	},
	{
		id: "plugins:view",
		description: "View registered plugins",
		pluginId: "core",
	},

	// Access (admin-only by convention; admins bypass policies anyway, but
	// these are surfaced so custom admin-equivalent roles can be built)
	{
		id: "users:list",
		description: "View users",
		resourceKind: "user",
		pluginId: "core",
	},
	{
		id: "users:invite",
		description: "Invite a new user",
		resourceKind: "user",
		pluginId: "core",
	},
	{
		id: "users:edit",
		description: "Edit user profile",
		resourceKind: "user",
		pluginId: "core",
	},
	{
		id: "users:revoke",
		description: "Revoke a user",
		resourceKind: "user",
		pluginId: "core",
	},
	{
		id: "roles:manage",
		description: "Create, edit, or delete custom roles",
		resourceKind: "role",
		pluginId: "core",
	},
	{
		id: "roles:assign",
		description: "Assign roles to users",
		resourceKind: "role",
		pluginId: "core",
	},
	{
		id: "grants:manage",
		description: "Add or remove direct user grants",
		resourceKind: "grant",
		pluginId: "core",
	},

	// Operations
	{ id: "system:view", description: "View system status", pluginId: "core" },
	{ id: "settings:edit", description: "Edit settings", pluginId: "core" },
	{ id: "host:view", description: "View host panel", pluginId: "core" },
	{
		id: "data:view",
		description: "View data backend status",
		pluginId: "core",
	},
	{
		id: "backups:manage",
		description: "Schedule and run backups",
		pluginId: "core",
	},
	{ id: "audit:view", description: "View audit log", pluginId: "core" },
];
