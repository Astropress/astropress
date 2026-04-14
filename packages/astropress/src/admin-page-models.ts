import type { APIContext } from "astro";
import { getCmsConfig } from "./config";
import { buildAdminDashboardModel } from "./admin-dashboard";
import { defaultSiteSettings } from "./site-settings";
import { isSeededPostRecord } from "./seeded-content-type";
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
  getRuntimeStructuredPageRoute,
  listRuntimeStructuredPageRoutes,
  listRuntimeSystemRoutes,
} from "./runtime-route-registry";
import {
  type AdminPageResult,
  ok,
  forbidden,
  notFound,
  adminOnlyPage,
  withFallback,
  withSettledMap,
  emptyDashboardModel,
} from "./admin-page-model-helpers";

// ─── Editor models — extracted to admin-page-models-editors.ts ───────────────
export {
  buildPostEditorPageModel,
  buildPostRevisionsPageModel,
  buildRoutePageEditorModel,
  buildArchiveEditorModel,
  buildResetPasswordPageModel,
  buildAcceptInvitePageModel,
} from "./admin-page-models-editors";
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

export async function buildTestimonialsPageModel(locals: AdminLocals) {
  const warnings: string[] = [];
  return ok({
    pending: await withFallback(warnings, "Pending testimonials are temporarily unavailable.", () => getRuntimeTestimonials("pending", locals), []),
    approved: await withFallback(warnings, "Approved testimonials are temporarily unavailable.", () => getRuntimeTestimonials("approved", locals), []),
    featured: await withFallback(warnings, "Featured testimonials are temporarily unavailable.", () => getRuntimeTestimonials("featured", locals), []),
    auditEvents: await withFallback(warnings, "Testimonial audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []),
  }, warnings);
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
  const archiveList = (getCmsConfig().archives as Array<{ slug: string; title: string; legacyUrl: string; listingItems?: Array<{ href: string }> }>).map(
    (a) => ({ ...a, listingItems: a.listingItems ?? ([] as Array<{ href: string }>) }),
  );
  const archives = await withSettledMap(
    warnings,
    "Archive filters are temporarily unavailable.",
    archiveList,
    async (archive) => {
      const runtimeArchive = await getRuntimeArchiveRoute(archive.legacyUrl, locals);
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

export async function buildTranslationsPageModel(locals: AdminLocals, role: AdminRole) {
  const empty = { rows: [] as Array<any> };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const seedPages = getCmsConfig().seedPages as Array<{ slug: string; legacyUrl: string; title: string }>;
  const translationEntries = (getCmsConfig().translationStatus as Array<{ route: string; translationState: string; englishSourceUrl: string; locale: string }>).map((entry) => {
    const englishSeed = seedPages.find((page) => page.legacyUrl === entry.englishSourceUrl);
    return { ...entry, englishEditHref: englishSeed ? `/ap-admin/posts/${englishSeed.slug}` : undefined };
  });
  const rows = await withSettledMap(
    warnings,
    "Some translation rows are temporarily unavailable.",
    translationEntries,
    async (entry) => {
      const localizedRoute = await getRuntimeStructuredPageRoute(entry.route, locals);
      return {
        ...entry,
        effectiveState: await getRuntimeTranslationState(entry.route, entry.translationState, locals),
        localizedEditHref: localizedRoute ? `/ap-admin/route-pages${entry.route}` : undefined,
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

