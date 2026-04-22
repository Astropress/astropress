import type { APIContext } from "astro";
import { buildAdminDashboardModel } from "./admin-dashboard";
import {
	type AdminPageResult,
	adminOnlyPage,
	emptyDashboardModel,
	ok,
	withFallback,
} from "./admin-page-model-helpers";
import { getCmsConfig } from "./config";
import { resolveRuntimeMediaUrl } from "./media";
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

// ─── Editor models — extracted to admin-page-models-editors.ts ───────────────
export {
	buildPostEditorPageModel,
	buildPostRevisionsPageModel,
	buildRoutePageEditorModel,
	buildArchiveEditorModel,
	buildResetPasswordPageModel,
	buildAcceptInvitePageModel,
} from "./admin-page-models-editors";

// ─── Listing/index models — extracted to admin-page-models-listings.ts ────────
export {
	buildArchivesIndexPageModel,
	buildPagesIndexPageModel,
	buildPostsIndexPageModel,
	buildTranslationsPageModel,
	buildSeoPageModel,
} from "./admin-page-models-listings";

export type { AdminPageResult } from "./admin-page-model-helpers";

type AdminLocals = APIContext["locals"];
type AdminRole = "admin" | "editor";

export async function buildAdminDashboardPageModel(
	locals: AdminLocals,
	role: AdminRole,
): Promise<AdminPageResult<AdminDashboardModel>> {
	const warnings: string[] = [];
	const data = await withFallback(
		warnings,
		"Some dashboard counts are temporarily unavailable.",
		() =>
			buildAdminDashboardModel(
				locals,
				role,
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
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
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
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
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

export async function buildUsersPageModel(
	locals: AdminLocals,
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
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
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
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
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
		{ settings: defaultSiteSettings },
		async (warnings) => ({
			settings: await withFallback(
				warnings,
				"Settings could not be loaded. Showing defaults.",
				() => getRuntimeSettings(locals),
				defaultSiteSettings,
			),
		}),
	);
}

export async function buildSystemPageModel(
	locals: AdminLocals,
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
		{ systemRoutes: [], routeMap: new Map<string, unknown>() },
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
	role: AdminRole,
) {
	return adminOnlyPage(
		role,
		{
			routePages: [] as Awaited<
				ReturnType<typeof listRuntimeStructuredPageRoutes>
			>,
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
