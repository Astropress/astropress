// ─── Listing/index page models — extracted from admin-page-models.ts ──────────
import type { APIContext } from "astro";
import {
	forbidden,
	ok,
	withFallback,
	withSettledMap,
} from "./admin-page-model-helpers";
import { getCmsConfig } from "./config";
import {
	getRuntimeAuthors,
	getRuntimeCategories,
	getRuntimeTags,
	getRuntimeTranslationState,
	listRuntimeContentStates,
	listRuntimeStructuredPageRoutes,
	listRuntimeSystemRoutes,
} from "./runtime-page-store";
import {
	getRuntimeArchiveRoute,
	getRuntimeStructuredPageRoute,
} from "./runtime-route-registry";
import { isSeededPostRecord } from "./seeded-content-type";

type AdminLocals = APIContext["locals"];
type AdminRole = "admin" | "editor";

export async function buildArchivesIndexPageModel(
	locals: AdminLocals,
	role: AdminRole,
) {
	const empty = {
		archiveList: [] as unknown[],
		archivesByKind: {} as Record<string, unknown[]>,
		kindCounts: [] as Array<{ kind: string; count: number }>,
		totalArchives: 0,
		totalItems: 0,
	};
	if (role !== "admin") {
		return forbidden(empty);
	}

	const warnings: string[] = [];
	const archiveList = await withSettledMap(
		warnings,
		"Some archive metadata is temporarily unavailable.",
		getCmsConfig().archives as Array<{
			title: string;
			kind: string;
			slug: string;
			legacyUrl: string;
			listingItems?: unknown[];
		}>,
		async (archive) => {
			const runtimeArchive = await getRuntimeArchiveRoute(
				archive.legacyUrl,
				locals,
			);
			return {
				...archive,
				title: runtimeArchive?.title || archive.title,
			};
		},
		(archive) => archive,
	);

	const archivesByKind = archiveList.reduce<Record<string, unknown[]>>(
		(acc, archive) => {
			if (!acc[archive.kind]) {
				acc[archive.kind] = [];
			}
			acc[archive.kind].push(archive);
			return acc;
		},
		{},
	);

	const kindCounts = Object.entries(archivesByKind).map(([kind, items]) => ({
		kind,
		count: items.length,
	}));
	const totalArchives = archiveList.length;
	const totalItems = archiveList.reduce(
		(sum, archive) => sum + (archive.listingItems?.length || 0),
		0,
	);

	return ok(
		{ archiveList, archivesByKind, kindCounts, totalArchives, totalItems },
		warnings,
	);
}

export async function buildPagesIndexPageModel(
	locals: AdminLocals,
	role: AdminRole,
) {
	const empty = {
		contentStates: [] as Awaited<ReturnType<typeof listRuntimeContentStates>>,
		routePages: [] as Awaited<
			ReturnType<typeof listRuntimeStructuredPageRoutes>
		>,
		archiveRows: [] as unknown[],
	};
	if (role !== "admin") {
		return forbidden(empty);
	}

	const warnings: string[] = [];
	const contentStates = await withFallback(
		warnings,
		"Legacy page records are temporarily unavailable.",
		() => listRuntimeContentStates(locals),
		[],
	);
	const routePages = await withFallback(
		warnings,
		"Structured page records are temporarily unavailable.",
		() => listRuntimeStructuredPageRoutes(locals),
		[],
	);
	const archiveRows = await withSettledMap(
		warnings,
		"Some archive page records are temporarily unavailable.",
		getCmsConfig().archives as unknown as Array<{
			slug: string;
			legacyUrl: string;
			title: string;
		}>,
		async (archive) => ({
			archive,
			runtime: await getRuntimeArchiveRoute(archive.legacyUrl, locals),
		}),
		(archive) => ({ archive, runtime: null }),
	);

	return ok({ contentStates, routePages, archiveRows }, warnings);
}

export async function buildPostsIndexPageModel(locals: AdminLocals) {
	const warnings: string[] = [];
	const authors = await withFallback(
		warnings,
		"Author filters are temporarily unavailable.",
		() => getRuntimeAuthors(locals),
		[],
	);
	const categories = await withFallback(
		warnings,
		"Category filters are temporarily unavailable.",
		() => getRuntimeCategories(locals),
		[],
	);
	const tags = await withFallback(
		warnings,
		"Tag filters are temporarily unavailable.",
		() => getRuntimeTags(locals),
		[],
	);
	const allContent = await withFallback(
		warnings,
		"Post records are temporarily unavailable.",
		() => listRuntimeContentStates(locals),
		[],
	);
	const archiveList = (
		getCmsConfig().archives as Array<{
			slug: string;
			title: string;
			legacyUrl: string;
			listingItems?: Array<{ href: string }>;
		}>
	).map((a) => ({
		...a,
		listingItems: a.listingItems ?? ([] as Array<{ href: string }>),
	}));
	const archives = await withSettledMap(
		warnings,
		"Archive filters are temporarily unavailable.",
		archiveList,
		async (archive) => {
			const runtimeArchive = await getRuntimeArchiveRoute(
				archive.legacyUrl,
				locals,
			);
			return {
				slug: archive.slug,
				title: runtimeArchive?.title || archive.title,
				listingItems: archive.listingItems,
			};
		},
		(archive) => ({
			slug: archive.slug,
			title: archive.title,
			listingItems: archive.listingItems,
		}),
	);
	return ok({ authors, categories, tags, allContent, archives }, warnings);
}

export async function buildTranslationsPageModel(
	locals: AdminLocals,
	role: AdminRole,
) {
	const empty = { rows: [] as unknown[] };
	if (role !== "admin") {
		return forbidden(empty);
	}

	const warnings: string[] = [];
	const seedPages = getCmsConfig().seedPages as Array<{
		slug: string;
		legacyUrl: string;
		title: string;
	}>;
	const translationEntries = (
		getCmsConfig().translationStatus as Array<{
			route: string;
			translationState: string;
			englishSourceUrl: string;
			locale: string;
		}>
	).map((entry) => {
		const englishSeed = seedPages.find(
			(page) => page.legacyUrl === entry.englishSourceUrl,
		);
		return {
			...entry,
			englishEditHref: englishSeed
				? `/ap-admin/posts/${englishSeed.slug}`
				: undefined,
		};
	});
	const rows = await withSettledMap(
		warnings,
		"Some translation rows are temporarily unavailable.",
		translationEntries,
		async (entry) => {
			const localizedRoute = await getRuntimeStructuredPageRoute(
				entry.route,
				locals,
			);
			return {
				...entry,
				effectiveState: await getRuntimeTranslationState(
					entry.route,
					entry.translationState,
					locals,
				),
				localizedEditHref: localizedRoute
					? `/ap-admin/route-pages${entry.route}`
					: undefined,
			};
		},
		(entry) => ({
			...entry,
			effectiveState: entry.translationState,
			localizedEditHref: undefined,
		}),
	);

	return ok({ rows }, warnings);
}

export async function buildSeoPageModel(locals: AdminLocals, role: AdminRole) {
	const empty = { rows: [] as unknown[] };
	if (role !== "admin") {
		return forbidden(empty);
	}

	const warnings: string[] = [];
	const contentStates = await withFallback(
		warnings,
		"Content SEO records are temporarily unavailable.",
		() => listRuntimeContentStates(locals),
		[],
	);
	const routePages = await withFallback(
		warnings,
		"Structured page SEO records are temporarily unavailable.",
		() => listRuntimeStructuredPageRoutes(locals),
		[],
	);
	const systemRoutes = await withFallback(
		warnings,
		"System route SEO records are temporarily unavailable.",
		() => listRuntimeSystemRoutes(locals),
		[],
	);
	const archiveRoutes = await withSettledMap(
		warnings,
		"Some archive SEO records are temporarily unavailable.",
		getCmsConfig().archives as unknown as Array<{
			slug: string;
			title: string;
			legacyUrl: string;
		}>,
		async (archive) => ({
			archive,
			runtime: await getRuntimeArchiveRoute(archive.legacyUrl, locals),
		}),
		(archive) => ({ archive, runtime: null }),
	);

	const rows = [
		...contentStates.map((record) => ({
			label: record.title,
			type: isSeededPostRecord(record) ? "Post" : "Page",
			path: record.legacyUrl,
			seoTitle: record.seoTitle || "—",
			metaDescription: record.metaDescription || "—",
			missingMetadata: !record.seoTitle || !record.metaDescription,
			editHref: `/ap-admin/posts/${record.slug}`,
		})),
		...routePages.map((route) => ({
			label: route.title,
			type: "Structured Page",
			path: route.path,
			seoTitle: route.seoTitle || route.title,
			metaDescription: route.metaDescription || route.summary || "—",
			missingMetadata: !route.seoTitle || !route.metaDescription,
			editHref: `/ap-admin/route-pages${route.path}`,
		})),
		...archiveRoutes.map(({ archive, runtime }) => ({
			label: runtime?.title ?? archive.title,
			type: "Archive",
			path: archive.legacyUrl,
			seoTitle: runtime?.seoTitle || runtime?.title || archive.title,
			metaDescription: runtime?.metaDescription || runtime?.summary || "—",
			missingMetadata: !runtime?.seoTitle || !runtime?.metaDescription,
			editHref: `/ap-admin/archives/${archive.slug}`,
		})),
		...systemRoutes.map((route) => ({
			label: route.title,
			type: "System",
			path: route.path,
			seoTitle: route.title,
			metaDescription: route.summary || "—",
			missingMetadata: !route.summary,
			editHref: "/ap-admin/system",
		})),
	];

	return ok({ rows }, warnings);
}
