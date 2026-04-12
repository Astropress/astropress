import { getCmsConfig, peekCmsConfig } from "./config";
import { createD1AdminReadStore } from "./d1-admin-store";
import { searchD1ContentStates } from "./d1-store-content";
import { safeLoadLocalAdminStore } from "./admin-store-dispatch";
import type { ContentRecord, ContentStatus } from "./persistence-types";
import { getCloudflareBindings } from "./runtime-env";
import { defaultSiteSettings } from "./site-settings";
import type { D1AdminReadStore } from "./d1-admin-store";

type SeededContentRecord = ContentRecord & {
  id?: string;
  locale?: string;
  listingItems: unknown[];
  paginationLinks: unknown[];
};

function normalizeContentStatus(value: unknown): ContentStatus {
  if (value === "draft" || value === "review" || value === "published" || value === "archived") {
    return value;
  }

  return "published";
}

function getSeededContentRecords(): SeededContentRecord[] {
  return (getCmsConfig().seedPages as unknown as SeededContentRecord[]).map(
    (page) =>
      ({
        ...page,
        kind: typeof page.kind === "string" ? page.kind : undefined,
        status: normalizeContentStatus(page.status),
        listingItems: Array.isArray(page.listingItems) ? page.listingItems : [],
        paginationLinks: Array.isArray(page.paginationLinks) ? page.paginationLinks : [],
        scheduledAt: typeof page.scheduledAt === "string" ? page.scheduledAt : undefined,
        authorIds: Array.isArray(page.authorIds) ? page.authorIds : undefined,
        categoryIds: Array.isArray(page.categoryIds) ? page.categoryIds : undefined,
        tagIds: Array.isArray(page.tagIds) ? page.tagIds : undefined,
      }) satisfies SeededContentRecord,
  );
}

function createStaticReadStore(): D1AdminReadStore {
  return {
    audit: {
      getAuditEvents: async () => [],
    },
    users: {
      listAdminUsers: async () => [],
    },
    authors: {
      listAuthors: async () => [],
    },
    taxonomies: {
      listCategories: async () => [],
      listTags: async () => [],
    },
    redirects: {
      getRedirectRules: async () => [],
    },
    comments: {
      getComments: async () => [],
      getApprovedCommentsForRoute: async () => [],
    },
    content: {
      listContentStates: async () => getSeededContentRecords(),
      getContentState: async (slug: string) =>
        getSeededContentRecords().find((record) => record.slug === slug || record.legacyUrl === `/${slug}`) ?? null,
      getContentRevisions: async () => null,
    },
    submissions: {
      getContactSubmissions: async () => [],
    },
    translations: {
      getEffectiveTranslationState: async (_route: string, fallback = "not_started") => fallback,
    },
    settings: {
      getSettings: async () => defaultSiteSettings,
    },
    rateLimits: {
      checkRateLimit: async () => true,
      peekRateLimit: async () => true,
      recordFailedAttempt: async () => {},
    },
    media: {
      listMediaAssets: async () => [],
    },
  };
}

function createFallbackReadStore(localAdminStore: Awaited<ReturnType<typeof safeLoadLocalAdminStore>>): D1AdminReadStore {
  if (!localAdminStore) {
    return createStaticReadStore();
  }

  return {
    audit: {
      getAuditEvents: async () => localAdminStore.getAuditEvents(),
    },
    users: {
      listAdminUsers: async () =>
        localAdminStore.listAdminUsers().map((user) => ({
          ...user,
          role: user.role,
          status:
            user.status === "active" || user.status === "invited" || user.status === "suspended"
              ? user.status
              : "active",
        })),
    },
    authors: {
      listAuthors: async () => localAdminStore.listAuthors(),
    },
    taxonomies: {
      listCategories: async () => localAdminStore.listCategories(),
      listTags: async () => localAdminStore.listTags(),
    },
    redirects: {
      getRedirectRules: async () => localAdminStore.getRedirectRules(),
    },
    comments: {
      getComments: async () => localAdminStore.getComments(),
      getApprovedCommentsForRoute: async (route: string) =>
        localAdminStore.getComments().filter((comment) => comment.route === route && comment.status === "approved"),
    },
    content: {
      listContentStates: async () => localAdminStore.listContentStates(),
      getContentState: async (slug: string) => localAdminStore.getContentState(slug),
      getContentRevisions: async (slug: string) => localAdminStore.getContentRevisions(slug),
    },
    submissions: {
      getContactSubmissions: async () => localAdminStore.getContactSubmissions(),
    },
    translations: {
      getEffectiveTranslationState: async (route: string, fallback = "not_started") =>
        localAdminStore.getEffectiveTranslationState(route, fallback),
    },
    settings: {
      getSettings: async () => localAdminStore.getSettings(),
    },
    rateLimits: {
      checkRateLimit: async () => true,
      peekRateLimit: async () => true,
      recordFailedAttempt: async () => {},
    },
    media: {
      listMediaAssets: async () => localAdminStore.listMediaAssets(),
    },
  };
}

function withFallback<A extends unknown[], R>(
  primary: (...args: A) => Promise<R>,
  fallback: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await primary(...args);
    } catch {
      return await fallback(...args);
    }
  };
}

async function getReadStore(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;
  const localAdminStore = await safeLoadLocalAdminStore();
  const fallbackStore = createFallbackReadStore(localAdminStore);

  if (!db) {
    return fallbackStore;
  }

  const d1 = createD1AdminReadStore(db);
  const fb = fallbackStore;
  const wf = withFallback;
  return {
    audit: { getAuditEvents: wf(d1.audit.getAuditEvents, fb.audit.getAuditEvents) },
    users: { listAdminUsers: wf(d1.users.listAdminUsers, fb.users.listAdminUsers) },
    authors: { listAuthors: wf(d1.authors.listAuthors, fb.authors.listAuthors) },
    taxonomies: {
      listCategories: wf(d1.taxonomies.listCategories, fb.taxonomies.listCategories),
      listTags: wf(d1.taxonomies.listTags, fb.taxonomies.listTags),
    },
    redirects: { getRedirectRules: wf(d1.redirects.getRedirectRules, fb.redirects.getRedirectRules) },
    comments: {
      getComments: wf(d1.comments.getComments, fb.comments.getComments),
      getApprovedCommentsForRoute: wf(d1.comments.getApprovedCommentsForRoute, fb.comments.getApprovedCommentsForRoute),
    },
    content: {
      listContentStates: wf(d1.content.listContentStates, fb.content.listContentStates),
      getContentState: wf(d1.content.getContentState, fb.content.getContentState),
      getContentRevisions: wf(d1.content.getContentRevisions, fb.content.getContentRevisions),
    },
    submissions: { getContactSubmissions: wf(d1.submissions.getContactSubmissions, fb.submissions.getContactSubmissions) },
    translations: { getEffectiveTranslationState: wf(d1.translations.getEffectiveTranslationState, fb.translations.getEffectiveTranslationState) },
    settings: { getSettings: wf(d1.settings.getSettings, fb.settings.getSettings) },
    rateLimits: {
      checkRateLimit: wf(d1.rateLimits.checkRateLimit, fb.rateLimits.checkRateLimit),
      peekRateLimit: wf(d1.rateLimits.peekRateLimit, fb.rateLimits.peekRateLimit),
      recordFailedAttempt: wf(d1.rateLimits.recordFailedAttempt, fb.rateLimits.recordFailedAttempt),
    },
    media: { listMediaAssets: wf(d1.media.listMediaAssets, fb.media.listMediaAssets) },
  } satisfies D1AdminReadStore;
}

export async function getRuntimeAuditEvents(locals?: App.Locals | null) {
  return (await getReadStore(locals)).audit.getAuditEvents();
}

export async function getRuntimeAdminUsers(locals?: App.Locals | null) {
  return (await getReadStore(locals)).users.listAdminUsers();
}

export async function getRuntimeAuthors(locals?: App.Locals | null) {
  return (await getReadStore(locals)).authors.listAuthors();
}

export async function getRuntimeCategories(locals?: App.Locals | null) {
  return (await getReadStore(locals)).taxonomies.listCategories();
}

export async function getRuntimeTags(locals?: App.Locals | null) {
  return (await getReadStore(locals)).taxonomies.listTags();
}

export async function getRuntimeRedirectRules(locals?: App.Locals | null) {
  return (await getReadStore(locals)).redirects.getRedirectRules();
}

export async function getRuntimeComments(locals?: App.Locals | null) {
  return (await getReadStore(locals)).comments.getComments();
}

export async function getRuntimeContentState(slug: string, locals?: App.Locals | null) {
  return (await getReadStore(locals)).content.getContentState(slug);
}

export async function listRuntimeContentStates(locals?: App.Locals | null) {
  return (await getReadStore(locals)).content.listContentStates();
}

export async function searchRuntimeContentStates(query: string, locals?: App.Locals | null): Promise<ContentRecord[]> {
  if (!peekCmsConfig()?.search?.enabled) {
    console.warn("[astropress] searchRuntimeContentStates called but search.enabled is not true in CmsConfig");
    return [];
  }
  const store = await safeLoadLocalAdminStore();
  if (store?.searchContentStates) {
    return store.searchContentStates(query);
  }
  const db = getCloudflareBindings(locals).DB;
  if (db) {
    return searchD1ContentStates(db, query);
  }
  console.warn("[astropress] searchRuntimeContentStates: no FTS-capable store available");
  return [];
}

export async function getRuntimeContentStateByPath(pathname: string, locals?: App.Locals | null) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const records = await listRuntimeContentStates(locals);
  return records.find((record) => record.legacyUrl === normalizedPath) ?? null;
}

export async function getRuntimeContentRevisions(slug: string, locals?: App.Locals | null) {
  return (await getReadStore(locals)).content.getContentRevisions(slug);
}

export async function getRuntimeTranslationState(route: string, fallback = "not_started", locals?: App.Locals | null) {
  return (await getReadStore(locals)).translations.getEffectiveTranslationState(route, fallback);
}

export async function getRuntimeSettings(locals?: App.Locals | null) {
  return (await getReadStore(locals)).settings.getSettings();
}

export async function getRuntimeContactSubmissions(locals?: App.Locals | null) {
  return (await getReadStore(locals)).submissions.getContactSubmissions();
}

export async function getRuntimeMediaAssets(locals?: App.Locals | null) {
  return (await getReadStore(locals)).media.listMediaAssets();
}

// ─── Mutation store — extracted to runtime-mutation-store.ts ─────────────────
export {
  checkRuntimeRateLimit,
  peekRuntimeRateLimit,
  recordRuntimeFailedAttempt,
  submitRuntimeContact,
  submitRuntimePublicComment,
} from "./runtime-mutation-store";
