import type { APIContext } from "astro";
import type { AdminDashboardModel } from "./admin-dashboard";
import { buildAdminDashboardModel } from "./admin-dashboard";
import {
	type AdminPageResult,
	adminOnlyPage,
	emptyDashboardModel,
	forbidden,
	ok,
	withFallback,
} from "./admin-page-model-helpers";
import { getCmsConfig } from "./config";
import { resolveRuntimeMediaUrl } from "./media";
import type { AuthUser } from "./platform-contracts";
import {
	getRuntimeAdminUsers,
	getRuntimeAuditEvents,
	getRuntimeAuthors,
	getRuntimeCategories,
	getRuntimeComments,
	getRuntimeMediaAssets,
	getRuntimeRedirectRules,
	getRuntimeSettings,
	getRuntimeTags,
	getRuntimeTestimonials,
	getRuntimeTranslationState,
	listRuntimeContentStates,
} from "./runtime-page-store";
import {
	getRuntimeArchiveRoute,
	listRuntimeStructuredPageRoutes,
	listRuntimeSystemRoutes,
} from "./runtime-route-registry";
import { isSeededPostRecord } from "./seeded-content-type";
import { defaultSiteSettings } from "./site-settings";

export type { AdminPageResult } from "./admin-page-model-helpers";
// ─── Editor models — extracted to admin-page-models-editors.ts ───────────────
export {
	buildAcceptInvitePageModel,
	buildArchiveEditorModel,
	buildPostEditorPageModel,
	buildPostRevisionsPageModel,
	buildResetPasswordPageModel,
	buildRoutePageEditorModel,
} from "./admin-page-models-editors";
// ─── Listing/index models — extracted to admin-page-models-listings.ts ────────
export {
	buildArchivesIndexPageModel,
	buildPagesIndexPageModel,
	buildPostsIndexPageModel,
	buildSeoPageModel,
	buildTranslationsPageModel,
} from "./admin-page-models-listings";

type AdminLocals = APIContext["locals"];

export async function buildAdminDashboardPageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
): Promise<AdminPageResult<AdminDashboardModel>> {
	// #197: the dashboard is authenticated-only (admin *or* editor). Without this
	// guard the model builds the editorial overview for anonymous callers and the
	// page renders it — unlike every peer route, which redirect/403 unauthenticated
	// requests. A present user of any role passes; only a missing user is refused.
	if (!user) return forbidden(emptyDashboardModel());
	const warnings: string[] = [];
	const data = await withFallback(
		warnings,
		"Some dashboard counts are temporarily unavailable.",
		() =>
			buildAdminDashboardModel(
				locals,
				user,
				getCmsConfig().translationStatus as unknown as Array<{
					route: string;
					translationState: string;
				}>,
				{
					getRuntimeAuditEvents,
					getRuntimeComments,
					getRuntimeRedirectRules,
					getRuntimeTranslationState,
					listRuntimeContentStates,
					listRuntimeStructuredPageRoutes,
					listRuntimeSystemRoutes,
					getRuntimeArchiveRoute,
					isSeededPostRecord,
				},
			),
		emptyDashboardModel(),
	);

	return ok(data, warnings);
}

export async function buildAuthorsPageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
) {
	return adminOnlyPage(
		user,
		{
			authors: [],
			auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>>,
		},
		async (warnings) => ({
			authors: await withFallback(
				warnings,
				"Author records are temporarily unavailable.",
				() => getRuntimeAuthors(locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Author audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		}),
	);
}

export async function buildTaxonomiesPageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
) {
	return adminOnlyPage(
		user,
		{
			categories: [],
			tags: [],
			auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>>,
		},
		async (warnings) => ({
			categories: await withFallback(
				warnings,
				"Categories are temporarily unavailable.",
				() => getRuntimeCategories(locals),
				[],
			),
			tags: await withFallback(
				warnings,
				"Tags are temporarily unavailable.",
				() => getRuntimeTags(locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Taxonomy audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		}),
	);
}

export async function buildUsersPageModel(locals: AdminLocals, user: AuthUser | null | undefined) {
	return adminOnlyPage(
		user,
		{
			users: [],
			auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>>,
		},
		async (warnings) => ({
			users: await withFallback(
				warnings,
				"User records are temporarily unavailable.",
				() => getRuntimeAdminUsers(locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Access audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		}),
	);
}

export async function buildTestimonialsPageModel(locals: AdminLocals) {
	const warnings: string[] = [];
	return ok(
		{
			pending: await withFallback(
				warnings,
				"Pending testimonials are temporarily unavailable.",
				() => getRuntimeTestimonials("pending", locals),
				[],
			),
			approved: await withFallback(
				warnings,
				"Approved testimonials are temporarily unavailable.",
				() => getRuntimeTestimonials("approved", locals),
				[],
			),
			featured: await withFallback(
				warnings,
				"Featured testimonials are temporarily unavailable.",
				() => getRuntimeTestimonials("featured", locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Testimonial audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		},
		warnings,
	);
}

export async function buildCommentsPageModel(locals: AdminLocals) {
	const warnings: string[] = [];
	return ok(
		{
			comments: await withFallback(
				warnings,
				"Comments are temporarily unavailable.",
				() => getRuntimeComments(locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Comment audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		},
		warnings,
	);
}

export async function buildMediaPageModel(locals: AdminLocals) {
	const warnings: string[] = [];
	const media = await withFallback(
		warnings,
		"Media assets are temporarily unavailable.",
		() => getRuntimeMediaAssets(locals),
		[],
	);
	const auditEvents = await withFallback(
		warnings,
		"Media audit history is temporarily unavailable.",
		() => getRuntimeAuditEvents(locals),
		[],
	);
	const mediaWithResolvedUrls = media.map((asset) => ({
		...asset,
		resolvedUrl: resolveRuntimeMediaUrl(asset, locals),
	}));
	return ok({ mediaWithResolvedUrls, auditEvents }, warnings);
}

export async function buildRedirectsPageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
) {
	return adminOnlyPage(
		user,
		{
			redirectRules: [],
			auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>>,
		},
		async (warnings) => ({
			redirectRules: await withFallback(
				warnings,
				"Redirect rules are temporarily unavailable.",
				() => getRuntimeRedirectRules(locals),
				[],
			),
			auditEvents: await withFallback(
				warnings,
				"Redirect audit history is temporarily unavailable.",
				() => getRuntimeAuditEvents(locals),
				[],
			),
		}),
	);
}

export async function buildSettingsPageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
) {
	return adminOnlyPage(user, { settings: defaultSiteSettings }, async (warnings) => ({
		settings: await withFallback(
			warnings,
			"Settings could not be loaded. Showing defaults.",
			() => getRuntimeSettings(locals),
			defaultSiteSettings,
		),
	}));
}

export async function buildSystemPageModel(locals: AdminLocals, user: AuthUser | null | undefined) {
	type SystemRouteEntry = Awaited<ReturnType<typeof listRuntimeSystemRoutes>>[number];
	return adminOnlyPage(
		user,
		{
			systemRoutes: [] as SystemRouteEntry[],
			routeMap: new Map<string, SystemRouteEntry>(),
		},
		async (warnings) => {
			const systemRoutes = await withFallback(
				warnings,
				"System routes are temporarily unavailable.",
				() => listRuntimeSystemRoutes(locals),
				[],
			);
			return {
				systemRoutes,
				routeMap: new Map(systemRoutes.map((route) => [route.path, route])),
			};
		},
	);
}

export async function buildRouteTablePageModel(
	locals: AdminLocals,
	user: AuthUser | null | undefined,
) {
	return adminOnlyPage(
		user,
		{
			routePages: [] as Awaited<ReturnType<typeof listRuntimeStructuredPageRoutes>>,
			settings: defaultSiteSettings,
		},
		async (warnings) => ({
			routePages: await withFallback(
				warnings,
				"Structured route records are temporarily unavailable.",
				() => listRuntimeStructuredPageRoutes(locals),
				[],
			),
			settings: await withFallback(
				warnings,
				"Settings could not be loaded. Showing defaults.",
				() => getRuntimeSettings(locals),
				defaultSiteSettings,
			),
		}),
	);
}
