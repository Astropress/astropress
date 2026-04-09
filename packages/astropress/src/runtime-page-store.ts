import { getCmsConfig } from "./config";
import { createD1AdminMutationStore, createD1AdminReadStore } from "./d1-admin-store";
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

function createStaticMutationStore() {
  return {
    submissions: {
      submitContact: async (input: { name: string; email: string; message: string; submittedAt: string }) => ({
        ok: true as const,
        submission: {
          id: crypto.randomUUID(),
          ...input,
        },
      }),
    },
    comments: {
      submitPublicComment: async (input: {
        author: string;
        email: string;
        body: string;
        route: string;
        submittedAt: string;
      }) => ({
        ok: true as const,
        comment: {
          id: crypto.randomUUID(),
          status: "pending" as const,
          policy: "open-moderated" as const,
          ...input,
        },
      }),
    },
    rateLimits: {
      checkRateLimit: async () => true,
      peekRateLimit: async () => true,
      recordFailedAttempt: async () => {},
    },
  };
}

async function getReadStore(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;
  const localAdminStore = await safeLoadLocalAdminStore();
  const fallbackStore = createFallbackReadStore(localAdminStore);

  if (db) {
    const d1Store = createD1AdminReadStore(db);
    return {
      audit: {
        getAuditEvents: async () => {
          try {
            return await d1Store.audit.getAuditEvents();
          } catch {
            return fallbackStore.audit.getAuditEvents();
          }
        },
      },
      users: {
        listAdminUsers: async () => {
          try {
            return await d1Store.users.listAdminUsers();
          } catch {
            return fallbackStore.users.listAdminUsers();
          }
        },
      },
      authors: {
        listAuthors: async () => {
          try {
            return await d1Store.authors.listAuthors();
          } catch {
            return fallbackStore.authors.listAuthors();
          }
        },
      },
      taxonomies: {
        listCategories: async () => {
          try {
            return await d1Store.taxonomies.listCategories();
          } catch {
            return fallbackStore.taxonomies.listCategories();
          }
        },
        listTags: async () => {
          try {
            return await d1Store.taxonomies.listTags();
          } catch {
            return fallbackStore.taxonomies.listTags();
          }
        },
      },
      redirects: {
        getRedirectRules: async () => {
          try {
            return await d1Store.redirects.getRedirectRules();
          } catch {
            return fallbackStore.redirects.getRedirectRules();
          }
        },
      },
      comments: {
        getComments: async () => {
          try {
            return await d1Store.comments.getComments();
          } catch {
            return fallbackStore.comments.getComments();
          }
        },
        getApprovedCommentsForRoute: async (route: string) => {
          try {
            return await d1Store.comments.getApprovedCommentsForRoute(route);
          } catch {
            return fallbackStore.comments.getApprovedCommentsForRoute(route);
          }
        },
      },
      content: {
        listContentStates: async () => {
          try {
            return await d1Store.content.listContentStates();
          } catch {
            return fallbackStore.content.listContentStates();
          }
        },
        getContentState: async (slug: string) => {
          try {
            return await d1Store.content.getContentState(slug);
          } catch {
            return fallbackStore.content.getContentState(slug);
          }
        },
        getContentRevisions: async (slug: string) => {
          try {
            return await d1Store.content.getContentRevisions(slug);
          } catch {
            return fallbackStore.content.getContentRevisions(slug);
          }
        },
      },
      submissions: {
        getContactSubmissions: async () => {
          try {
            return await d1Store.submissions.getContactSubmissions();
          } catch {
            return fallbackStore.submissions.getContactSubmissions();
          }
        },
      },
      translations: {
        getEffectiveTranslationState: async (route: string, fallback = "not_started") => {
          try {
            return await d1Store.translations.getEffectiveTranslationState(route, fallback);
          } catch {
            return fallbackStore.translations.getEffectiveTranslationState(route, fallback);
          }
        },
      },
      settings: {
        getSettings: async () => {
          try {
            return await d1Store.settings.getSettings();
          } catch {
            return fallbackStore.settings.getSettings();
          }
        },
      },
      rateLimits: {
        checkRateLimit: async (key: string, max: number, windowMs: number) => {
          try {
            return await d1Store.rateLimits.checkRateLimit(key, max, windowMs);
          } catch {
            return fallbackStore.rateLimits.checkRateLimit(key, max, windowMs);
          }
        },
        peekRateLimit: async (key: string, max: number, windowMs: number) => {
          try {
            return await d1Store.rateLimits.peekRateLimit(key, max, windowMs);
          } catch {
            return fallbackStore.rateLimits.peekRateLimit(key, max, windowMs);
          }
        },
        recordFailedAttempt: async (key: string, max: number, windowMs: number) => {
          try {
            return await d1Store.rateLimits.recordFailedAttempt(key, max, windowMs);
          } catch {
            return fallbackStore.rateLimits.recordFailedAttempt(key, max, windowMs);
          }
        },
      },
      media: {
        listMediaAssets: async () => {
          try {
            return await d1Store.media.listMediaAssets();
          } catch {
            return fallbackStore.media.listMediaAssets();
          }
        },
      },
    } satisfies D1AdminReadStore;
  }

  return fallbackStore;
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

async function getMutationStore(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;

  if (db) {
    return createD1AdminMutationStore(db);
  }

  const localAdminStore = await safeLoadLocalAdminStore();
  if (!localAdminStore) {
    return createStaticMutationStore();
  }

  return {
    submissions: {
      submitContact: async (input: { name: string; email: string; message: string; submittedAt: string }) =>
        localAdminStore.submitContact(input),
    },
    comments: {
      submitPublicComment: async (input: {
        author: string;
        email: string;
        body: string;
        route: string;
        submittedAt: string;
      }) => localAdminStore.submitPublicComment(input),
    },
    rateLimits: {
      checkRateLimit: async (key: string, max: number, windowMs: number) => localAdminStore.checkRateLimit(key, max, windowMs),
      peekRateLimit: async (key: string, max: number, windowMs: number) => localAdminStore.peekRateLimit(key, max, windowMs),
      recordFailedAttempt: async (key: string, max: number, windowMs: number) => localAdminStore.recordFailedAttempt(key, max, windowMs),
    },
  };
}

export async function checkRuntimeRateLimit(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.checkRateLimit(key, max, windowMs);
}

export async function peekRuntimeRateLimit(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.peekRateLimit(key, max, windowMs);
}

export async function recordRuntimeFailedAttempt(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.recordFailedAttempt(key, max, windowMs);
}

export async function submitRuntimeContact(
  input: { name: string; email: string; message: string; submittedAt: string },
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).submissions.submitContact(input);
}

export async function submitRuntimePublicComment(
  input: { author: string; email: string; body: string; route: string; submittedAt: string },
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).comments.submitPublicComment(input);
}
