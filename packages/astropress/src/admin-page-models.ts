import type { APIContext } from "astro";
import { getCmsConfig } from "./config";
import { buildAdminDashboardModel, type AdminDashboardModel } from "./admin-dashboard";
import { getAdminLocalePair } from "./admin-locale-links";
import { defaultSiteSettings } from "./site-settings";
import { isSeededPostRecord } from "./seeded-content-type";
import { resolveRuntimeMediaUrl } from "./media";
import {
  getRuntimeAdminUsers,
  getRuntimeAuditEvents,
  getRuntimeAuthors,
  getRuntimeCategories,
  getRuntimeComments,
  getRuntimeContentRevisions,
  getRuntimeContentState,
  getRuntimeContentStateByPath,
  getRuntimeMediaAssets,
  getRuntimeRedirectRules,
  getRuntimeSettings,
  getRuntimeTags,
  getRuntimeTranslationState,
  listRuntimeContentStates,
} from "./runtime-page-store";
import { getRuntimeInviteRequest, getRuntimePasswordResetRequest } from "./runtime-admin-actions";
import {
  getRuntimeArchiveRoute,
  getRuntimeStructuredPageRoute,
  listRuntimeStructuredPageRoutes,
  listRuntimeSystemRoutes,
} from "./runtime-route-registry";

type AdminLocals = APIContext["locals"];
type AdminRole = "admin" | "editor";
type Status = "ok" | "partial" | "forbidden" | "not_found";

export type AdminPageResult<T> = {
  status: Status;
  data: T;
  warnings: string[];
};

function result<T>(status: Status, data: T, warnings: string[] = []): AdminPageResult<T> {
  return { status, data, warnings };
}

function ok<T>(data: T, warnings: string[] = []): AdminPageResult<T> {
  return result(warnings.length > 0 ? "partial" : "ok", data, warnings);
}

function forbidden<T>(data: T): AdminPageResult<T> {
  return result("forbidden", data);
}

function notFound<T>(data: T, warnings: string[] = []): AdminPageResult<T> {
  return result("not_found", data, warnings);
}

async function adminOnlyPage<T>(
  role: AdminRole,
  empty: T,
  build: (warnings: string[]) => Promise<T>,
): Promise<AdminPageResult<T>> {
  if (role !== "admin") return forbidden(empty);
  const warnings: string[] = [];
  return ok(await build(warnings), warnings);
}

async function withFallback<T>(
  warnings: string[],
  message: string,
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch {
    warnings.push(message);
    return fallback;
  }
}

async function withSettledMap<TInput, TOutput>(
  warnings: string[],
  message: string,
  items: TInput[],
  map: (item: TInput) => Promise<TOutput>,
  fallback: (item: TInput) => TOutput,
): Promise<TOutput[]> {
  const settled = await Promise.allSettled(items.map((item) => map(item)));
  const hadFailure = settled.some((entry) => entry.status === "rejected");
  if (hadFailure) {
    warnings.push(message);
  }

  return settled.map((entry, index) => entry.status === "fulfilled" ? entry.value : fallback(items[index]));
}

function emptyDashboardModel(): AdminDashboardModel {
  return {
    auditEvents: [],
    comments: [],
    redirectRules: [],
    routePages: [],
    contentStates: [],
    systemRoutes: [],
    posts: [],
    pages: [],
    reviewPosts: [],
    scheduledPosts: [],
    recentAuditEvents: [],
    recentActivity: [],
    translationNeedsAttention: 0,
    seoNeedsAttention: 0,
    archiveRoutes: [],
    supportSurfaceLinks: [],
  };
}

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
        getCmsConfig().translationStatus as unknown as Array<{ route: string; translationState: string }>,
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

export async function buildAuthorsPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { authors: [], auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>> }, async (warnings) => ({
    authors: await withFallback(warnings, "Author records are temporarily unavailable.", () => getRuntimeAuthors(locals), []),
    auditEvents: await withFallback(warnings, "Author audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }));
}

export async function buildTaxonomiesPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { categories: [], tags: [], auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>> }, async (warnings) => ({
    categories: await withFallback(warnings, "Categories are temporarily unavailable.", () => getRuntimeCategories(locals), []),
    tags: await withFallback(warnings, "Tags are temporarily unavailable.", () => getRuntimeTags(locals), []),
    auditEvents: await withFallback(warnings, "Taxonomy audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }));
}

export async function buildUsersPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { users: [], auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>> }, async (warnings) => ({
    users: await withFallback(warnings, "User records are temporarily unavailable.", () => getRuntimeAdminUsers(locals), []),
    auditEvents: await withFallback(warnings, "Access audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }));
}

export async function buildCommentsPageModel(locals: AdminLocals) {
  const warnings: string[] = [];
  return ok({
    comments: await withFallback(warnings, "Comments are temporarily unavailable.", () => getRuntimeComments(locals), []),
    auditEvents: await withFallback(warnings, "Comment audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }, warnings);
}

export async function buildMediaPageModel(locals: AdminLocals) {
  const warnings: string[] = [];
  const media = await withFallback(warnings, "Media assets are temporarily unavailable.", () => getRuntimeMediaAssets(locals), []);
  const auditEvents = await withFallback(warnings, "Media audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []);
  const mediaWithResolvedUrls = media.map((asset) => ({
    ...asset,
    resolvedUrl: resolveRuntimeMediaUrl(asset, locals),
  }));
  return ok({ mediaWithResolvedUrls, auditEvents }, warnings);
}

export async function buildRedirectsPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { redirectRules: [], auditEvents: [] as Awaited<ReturnType<typeof getRuntimeAuditEvents>> }, async (warnings) => ({
    redirectRules: await withFallback(warnings, "Redirect rules are temporarily unavailable.", () => getRuntimeRedirectRules(locals), []),
    auditEvents: await withFallback(warnings, "Redirect audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }));
}

export async function buildSettingsPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { settings: defaultSiteSettings }, async (warnings) => ({
    settings: await withFallback(warnings, "Settings could not be loaded. Showing defaults.", () => getRuntimeSettings(locals), defaultSiteSettings),
  }));
}

export async function buildSystemPageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { systemRoutes: [], routeMap: new Map<string, any>() }, async (warnings) => {
    const systemRoutes = await withFallback(warnings, "System routes are temporarily unavailable.", () => listRuntimeSystemRoutes(locals), []);
    return { systemRoutes, routeMap: new Map(systemRoutes.map((route) => [route.path, route])) };
  });
}

export async function buildRouteTablePageModel(locals: AdminLocals, role: AdminRole) {
  return adminOnlyPage(role, { routePages: [] as Awaited<ReturnType<typeof listRuntimeStructuredPageRoutes>>, settings: defaultSiteSettings }, async (warnings) => ({
    routePages: await withFallback(warnings, "Structured route records are temporarily unavailable.", () => listRuntimeStructuredPageRoutes(locals), []),
    settings: await withFallback(warnings, "Settings could not be loaded. Showing defaults.", () => getRuntimeSettings(locals), defaultSiteSettings),
  }));
}

export async function buildArchivesIndexPageModel(locals: AdminLocals, role: AdminRole) {
  const empty = { archiveList: [] as Array<any>, archivesByKind: {} as Record<string, Array<any>>, kindCounts: [] as Array<{ kind: string; count: number }>, totalArchives: 0, totalItems: 0 };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const archiveList = await withSettledMap(
    warnings,
    "Some archive metadata is temporarily unavailable.",
    getCmsConfig().archives as Array<{ title: string; kind: string; slug: string; legacyUrl: string; listingItems?: Array<any> }>,
    async (archive) => {
      const runtimeArchive = await getRuntimeArchiveRoute(archive.legacyUrl, locals);
      return {
        ...archive,
        title: runtimeArchive?.title || archive.title,
      };
    },
    (archive) => archive,
  );

  const archivesByKind = archiveList.reduce<Record<string, Array<any>>>((acc, archive) => {
    if (!acc[archive.kind]) {
      acc[archive.kind] = [];
    }
    acc[archive.kind].push(archive);
    return acc;
  }, {});

  const kindCounts = Object.entries(archivesByKind).map(([kind, items]) => ({ kind, count: items.length }));
  const totalArchives = archiveList.length;
  const totalItems = archiveList.reduce((sum, archive) => sum + (archive.listingItems?.length || 0), 0);

  return ok({ archiveList, archivesByKind, kindCounts, totalArchives, totalItems }, warnings);
}

export async function buildPagesIndexPageModel(locals: AdminLocals, role: AdminRole) {
  const empty = { contentStates: [] as Awaited<ReturnType<typeof listRuntimeContentStates>>, routePages: [] as Awaited<ReturnType<typeof listRuntimeStructuredPageRoutes>>, archiveRows: [] as Array<any> };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const contentStates = await withFallback(warnings, "Legacy page records are temporarily unavailable.", () => listRuntimeContentStates(locals), []);
  const routePages = await withFallback(warnings, "Structured page records are temporarily unavailable.", () => listRuntimeStructuredPageRoutes(locals), []);
  const archiveRows = await withSettledMap(
    warnings,
    "Some archive page records are temporarily unavailable.",
    getCmsConfig().archives as unknown as Array<{ slug: string; legacyUrl: string; title: string }>,
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
  const authors = await withFallback(warnings, "Author filters are temporarily unavailable.", () => getRuntimeAuthors(locals), []);
  const categories = await withFallback(warnings, "Category filters are temporarily unavailable.", () => getRuntimeCategories(locals), []);
  const tags = await withFallback(warnings, "Tag filters are temporarily unavailable.", () => getRuntimeTags(locals), []);
  const allContent = await withFallback(warnings, "Post records are temporarily unavailable.", () => listRuntimeContentStates(locals), []);
  const archives = await withSettledMap(
    warnings,
    "Archive filters are temporarily unavailable.",
    getCmsConfig().archives as Array<{ slug: string; title: string; legacyUrl: string; listingItems?: Array<{ href: string }> }>,
    async (archive) => {
      const runtimeArchive = await getRuntimeArchiveRoute(archive.legacyUrl, locals);
      return {
        slug: archive.slug,
        title: runtimeArchive?.title || archive.title,
        listingItems: archive.listingItems ?? [],
      };
    },
    (archive) => ({
      slug: archive.slug,
      title: archive.title,
      listingItems: archive.listingItems ?? [],
    }),
  );
  return ok({ authors, categories, tags, allContent, archives }, warnings);
}

export async function buildTranslationsPageModel(locals: AdminLocals, role: AdminRole) {
  const empty = { rows: [] as Array<any> };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const rows = await withSettledMap(
    warnings,
    "Some translation rows are temporarily unavailable.",
    getCmsConfig().translationStatus as Array<{ route: string; translationState: string; englishSourceUrl: string; locale: string }>,
    async (entry) => {
      const englishSeed = (getCmsConfig().seedPages as Array<{ slug: string; legacyUrl: string; title: string }>).find((page) => page.legacyUrl === entry.englishSourceUrl);
      const localizedRoute = await getRuntimeStructuredPageRoute(entry.route, locals);
      return {
        ...entry,
        effectiveState: await getRuntimeTranslationState(entry.route, entry.translationState, locals),
        englishEditHref: englishSeed ? `/wp-admin/posts/${englishSeed.slug}` : undefined,
        localizedEditHref: localizedRoute ? `/wp-admin/route-pages${entry.route}` : undefined,
      };
    },
    (entry) => {
      const englishSeed = (getCmsConfig().seedPages as Array<{ slug: string; legacyUrl: string; title: string }>).find((page) => page.legacyUrl === entry.englishSourceUrl);
      return {
        ...entry,
        effectiveState: entry.translationState,
        englishEditHref: englishSeed ? `/wp-admin/posts/${englishSeed.slug}` : undefined,
        localizedEditHref: undefined,
      };
    },
  );

  return ok({ rows }, warnings);
}

export async function buildSeoPageModel(locals: AdminLocals, role: AdminRole) {
  const empty = { rows: [] as Array<any> };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const contentStates = await withFallback(warnings, "Content SEO records are temporarily unavailable.", () => listRuntimeContentStates(locals), []);
  const routePages = await withFallback(warnings, "Structured page SEO records are temporarily unavailable.", () => listRuntimeStructuredPageRoutes(locals), []);
  const systemRoutes = await withFallback(warnings, "System route SEO records are temporarily unavailable.", () => listRuntimeSystemRoutes(locals), []);
  const archiveRoutes = await withSettledMap(
    warnings,
    "Some archive SEO records are temporarily unavailable.",
    getCmsConfig().archives as unknown as Array<{ slug: string; title: string; legacyUrl: string }>,
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
      editHref: `/wp-admin/posts/${record.slug}`,
    })),
    ...routePages.map((route) => ({
      label: route.title,
      type: "Structured Page",
      path: route.path,
      seoTitle: route.seoTitle || route.title,
      metaDescription: route.metaDescription || route.summary || "—",
      missingMetadata: !route.seoTitle || !route.metaDescription,
      editHref: `/wp-admin/route-pages${route.path}`,
    })),
    ...archiveRoutes.map(({ archive, runtime }) => ({
      label: runtime?.title ?? archive.title,
      type: "Archive",
      path: archive.legacyUrl,
      seoTitle: runtime?.seoTitle || runtime?.title || archive.title,
      metaDescription: runtime?.metaDescription || runtime?.summary || "—",
      missingMetadata: !runtime?.seoTitle || !runtime?.metaDescription,
      editHref: `/wp-admin/archives/${archive.slug}`,
    })),
    ...systemRoutes.map((route) => ({
      label: route.title,
      type: "System",
      path: route.path,
      seoTitle: route.title,
      metaDescription: route.summary || "—",
      missingMetadata: !route.summary,
      editHref: "/wp-admin/system",
    })),
  ];

  return ok({ rows }, warnings);
}

export async function buildPostEditorPageModel(locals: AdminLocals, slug: string) {
  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The content record could not be loaded.", () => getRuntimeContentState(slug, locals), null);
  if (!pageRecord) {
    return notFound({
      pageRecord: null,
      authors: [],
      categories: [],
      tags: [],
      auditEvents: [],
      englishOwnerRecord: null,
      localizedRouteRecord: null,
      effectiveTranslationState: undefined,
    }, warnings);
  }

  const authors = await withFallback(warnings, "Authors are temporarily unavailable.", () => getRuntimeAuthors(locals), []);
  const categories = await withFallback(warnings, "Categories are temporarily unavailable.", () => getRuntimeCategories(locals), []);
  const tags = await withFallback(warnings, "Tags are temporarily unavailable.", () => getRuntimeTags(locals), []);
  const auditEvents = await withFallback(warnings, "Audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []);
  const localePair = getAdminLocalePair(pageRecord.legacyUrl);
  const localizedRoutePath = localePair?.localizedRoute;
  const fallbackTranslationState = localePair?.translationState ?? "not_started";
  const englishOwnerRecord = localePair?.englishRoute && localePair.englishRoute !== pageRecord.legacyUrl
    ? await withFallback(warnings, "The linked English owner record is temporarily unavailable.", () => getRuntimeContentStateByPath(localePair.englishRoute, locals), null)
    : pageRecord;
  const localizedRouteRecord = localizedRoutePath
    ? await withFallback(warnings, "The linked locale route is temporarily unavailable.", () => getRuntimeStructuredPageRoute(localizedRoutePath, locals), null)
    : null;
  const effectiveTranslationState = localizedRoutePath
    ? await withFallback(warnings, "Translation state is temporarily unavailable.", () => getRuntimeTranslationState(localizedRoutePath, fallbackTranslationState, locals), fallbackTranslationState)
    : localePair?.translationState;

  return ok({ pageRecord, authors, categories, tags, auditEvents, englishOwnerRecord, localizedRouteRecord, effectiveTranslationState }, warnings);
}

export async function buildPostRevisionsPageModel(locals: AdminLocals, slug: string) {
  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The content record could not be loaded.", () => getRuntimeContentState(slug, locals), null);
  const revisions = pageRecord
    ? await withFallback(warnings, "Revision history is temporarily unavailable.", () => getRuntimeContentRevisions(slug, locals), null)
    : null;

  if (!pageRecord || !revisions) {
    return notFound({ pageRecord: null, revisions: null, auditEvents: [], authors: [], categories: [], tags: [] }, warnings);
  }

  const auditEvents = await withFallback(warnings, "Audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []);
  const authors = await withFallback(warnings, "Authors are temporarily unavailable.", () => getRuntimeAuthors(locals), []);
  const categories = await withFallback(warnings, "Categories are temporarily unavailable.", () => getRuntimeCategories(locals), []);
  const tags = await withFallback(warnings, "Tags are temporarily unavailable.", () => getRuntimeTags(locals), []);

  return ok({ pageRecord, revisions, auditEvents, authors, categories, tags }, warnings);
}

export async function buildRoutePageEditorModel(locals: AdminLocals, routePath: string, role: AdminRole) {
  const empty = { pageRecord: null, englishOwner: null, effectiveTranslationState: undefined };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The route page could not be loaded.", () => getRuntimeStructuredPageRoute(routePath, locals), null);
  if (!pageRecord) {
    return notFound(empty, warnings);
  }

  const localePair = getAdminLocalePair(routePath);
  const localizedRoutePath = localePair?.localizedRoute;
  const fallbackTranslationState = localePair?.translationState ?? "not_started";
  const englishOwner = localePair
    ? await withFallback(warnings, "The linked English owner record is temporarily unavailable.", () => getRuntimeContentStateByPath(localePair.englishRoute, locals), null)
    : null;
  const effectiveTranslationState = localizedRoutePath
    ? await withFallback(warnings, "Translation state is temporarily unavailable.", () => getRuntimeTranslationState(localizedRoutePath, fallbackTranslationState, locals), fallbackTranslationState)
    : localePair?.translationState;

  return ok({ pageRecord, englishOwner, effectiveTranslationState }, warnings);
}

export async function buildArchiveEditorModel(locals: AdminLocals, archivePath: string, role: AdminRole) {
  const empty = { archive: null };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const archive = await withFallback(warnings, "The archive record could not be loaded.", () => getRuntimeArchiveRoute(archivePath, locals), null);
  if (!archive) {
    return notFound(empty, warnings);
  }

  return ok({ archive }, warnings);
}

export async function buildResetPasswordPageModel(locals: AdminLocals, token: string) {
  const warnings: string[] = [];
  const request = token
    ? await withFallback(warnings, "The reset token could not be validated.", () => getRuntimePasswordResetRequest(token, locals), null)
    : null;
  return ok({ request }, warnings);
}

export async function buildAcceptInvitePageModel(locals: AdminLocals, token: string) {
  const warnings: string[] = [];
  const inviteRequest = token
    ? await withFallback(warnings, "The invite token could not be validated.", () => getRuntimeInviteRequest(token, locals), null)
    : null;
  return ok({ inviteRequest }, warnings);
}
