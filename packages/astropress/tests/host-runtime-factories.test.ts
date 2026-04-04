import { describe, expect, it, vi } from "vitest";
import {
  createAstropressAdminStoreModule,
  createAstropressCmsRegistryModule,
  createAstropressPasswordAuthModule,
} from "../src/host-runtime-factories";

describe("host runtime factories", () => {
  it("creates a delegating local admin store module from an AdminStoreAdapter getter", async () => {
    const getSessionUser = vi.fn(async () => ({ email: "admin@example.com", role: "admin", name: "Admin" }));
    const listAdminUsers = vi.fn(async () => [{ email: "admin@example.com", role: "admin", name: "Admin", active: true }]);

    const storeModule = createAstropressAdminStoreModule(() => ({
      audit: { getAuditEvents: vi.fn(async () => []) },
      auth: {
        createSession: vi.fn(() => "session"),
        getSessionUser,
        getCsrfToken: vi.fn(async () => "csrf"),
        revokeSession: vi.fn(async () => {}),
        createPasswordResetToken: vi.fn(async () => ({ ok: true, resetUrl: null })),
        getInviteRequest: vi.fn(async () => null),
        getPasswordResetRequest: vi.fn(async () => null),
        consumeInviteToken: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        consumePasswordResetToken: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        recordSuccessfulLogin: vi.fn(async () => {}),
        recordLogout: vi.fn(async () => {}),
      },
      users: {
        listAdminUsers,
        inviteAdminUser: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        suspendAdminUser: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        unsuspendAdminUser: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
      authors: {
        listAuthors: vi.fn(async () => []),
        createAuthor: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        updateAuthor: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        deleteAuthor: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
      taxonomies: {
        listCategories: vi.fn(async () => []),
        createCategory: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        updateCategory: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        deleteCategory: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        listTags: vi.fn(async () => []),
        createTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        updateTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        deleteTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
      redirects: {
        getRedirectRules: vi.fn(async () => []),
        createRedirectRule: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        deleteRedirectRule: vi.fn(async () => ({ ok: false })),
      },
      comments: {
        getComments: vi.fn(async () => []),
        moderateComment: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        submitPublicComment: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        getApprovedCommentsForRoute: vi.fn(async () => []),
      },
      content: {
        listContentStates: vi.fn(async () => []),
        getContentState: vi.fn(async () => null),
        getContentRevisions: vi.fn(async () => null),
        createContentRecord: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        saveContentState: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        restoreRevision: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
      submissions: {
        getContactSubmissions: vi.fn(async () => []),
        submitContact: vi.fn(async () => ({ ok: true, submission: { id: "1", name: "A", email: "a@example.com", message: "Hi", submittedAt: "now" } })),
      },
      translations: {
        updateTranslationState: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        getEffectiveTranslationState: vi.fn(async () => "draft"),
      },
      settings: {
        getSettings: vi.fn(async () => ({
          siteTitle: "Site",
          siteTagline: "Tagline",
          donationUrl: "",
          newsletterEnabled: true,
          commentsDefaultPolicy: "open-moderated",
        })),
        saveSettings: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
      rateLimits: {
        checkRateLimit: vi.fn(async () => true),
        peekRateLimit: vi.fn(async () => true),
        recordFailedAttempt: vi.fn(async () => {}),
      },
      media: {
        listMediaAssets: vi.fn(async () => []),
        createMediaAsset: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        updateMediaAsset: vi.fn(async () => ({ ok: false, error: "not implemented" })),
        deleteMediaAsset: vi.fn(async () => ({ ok: false, error: "not implemented" })),
      },
    }));

    expect(await storeModule.getSessionUser("session")).toMatchObject({ email: "admin@example.com" });
    expect(await storeModule.listAdminUsers()).toHaveLength(1);
    expect(getSessionUser).toHaveBeenCalledWith("session");
    expect(listAdminUsers).toHaveBeenCalled();
  });

  it("creates a password auth module from an authenticate function", async () => {
    const authModule = createAstropressPasswordAuthModule(async (email, password) => {
      if (email === "admin@example.com" && password === "secret") {
        return { email, role: "admin", name: "Admin" };
      }

      return null;
    });

    await expect(authModule.authenticateAdminUser("admin@example.com", "secret")).resolves.toMatchObject({
      email: "admin@example.com",
    });
    await expect(authModule.authenticateAdminUser("admin@example.com", "wrong")).resolves.toBeNull();
  });

  it("creates a delegating cms registry module", () => {
    const listSystemRoutes = vi.fn(() => [{ path: "/hello", title: "Hello", renderStrategy: "generated_text", settings: null }]);
    const getSystemRoute = vi.fn(() => null);
    const saveSystemRoute = vi.fn(() => ({ ok: false, error: "not implemented" }));
    const listStructuredPageRoutes = vi.fn(() => []);
    const getStructuredPageRoute = vi.fn(() => null);
    const saveStructuredPageRoute = vi.fn(() => ({ ok: false, error: "not implemented" }));
    const createStructuredPageRoute = vi.fn(() => ({ ok: false, error: "not implemented" }));
    const getArchiveRoute = vi.fn(() => null);
    const listArchiveRoutes = vi.fn(() => []);
    const saveArchiveRoute = vi.fn(() => ({ ok: false, error: "not implemented" }));

    const registryModule = createAstropressCmsRegistryModule({
      listSystemRoutes,
      getSystemRoute,
      saveSystemRoute,
      listStructuredPageRoutes,
      getStructuredPageRoute,
      saveStructuredPageRoute,
      createStructuredPageRoute,
      getArchiveRoute,
      listArchiveRoutes,
      saveArchiveRoute,
    });

    expect(registryModule.listSystemRoutes()).toHaveLength(1);
    expect(listSystemRoutes).toHaveBeenCalled();
    expect(registryModule.getArchiveRoute("/archive")).toBeNull();
    expect(getArchiveRoute).toHaveBeenCalledWith("/archive");
  });
});
