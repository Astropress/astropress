import { describe, expect, it, vi } from "vitest";
import {
	createAstropressAdminStoreModule,
	createAstropressBootstrapAdminUsers,
	createAstropressCmsRegistryModule,
	createAstropressHostRuntimeBundle,
	createAstropressPasswordAuthModule,
} from "../src/host-runtime-factories";

describe("host runtime factories", () => {
	it("creates a delegating local admin store module from an AdminStoreAdapter getter", async () => {
		const getSessionUser = vi.fn(async () => ({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		}));
		const listAdminUsers = vi.fn(async () => [
			{
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
				active: true,
			},
		]);

		const storeModule = createAstropressAdminStoreModule(() => ({
			audit: { getAuditEvents: vi.fn(async () => []) },
			auth: {
				createSession: vi.fn(() => "session"),
				getSessionUser,
				getCsrfToken: vi.fn(async () => "csrf"),
				revokeSession: vi.fn(async () => {}),
				createPasswordResetToken: vi.fn(async () => ({
					ok: true,
					resetUrl: null,
				})),
				getInviteRequest: vi.fn(async () => null),
				getPasswordResetRequest: vi.fn(async () => null),
				consumeInviteToken: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				consumePasswordResetToken: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				recordSuccessfulLogin: vi.fn(async () => {}),
				recordLogout: vi.fn(async () => {}),
			},
			users: {
				listAdminUsers,
				inviteAdminUser: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				suspendAdminUser: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				unsuspendAdminUser: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
			},
			authors: {
				listAuthors: vi.fn(async () => []),
				createAuthor: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				updateAuthor: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				deleteAuthor: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
			},
			taxonomies: {
				listCategories: vi.fn(async () => []),
				createCategory: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				updateCategory: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				deleteCategory: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				listTags: vi.fn(async () => []),
				createTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
				updateTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
				deleteTag: vi.fn(async () => ({ ok: false, error: "not implemented" })),
			},
			redirects: {
				getRedirectRules: vi.fn(async () => []),
				createRedirectRule: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				deleteRedirectRule: vi.fn(async () => ({ ok: false })),
			},
			comments: {
				getComments: vi.fn(async () => []),
				moderateComment: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				submitPublicComment: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				getApprovedCommentsForRoute: vi.fn(async () => []),
			},
			content: {
				listContentStates: vi.fn(async () => []),
				getContentState: vi.fn(async () => null),
				getContentRevisions: vi.fn(async () => null),
				createContentRecord: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				saveContentState: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				restoreRevision: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
			},
			submissions: {
				getContactSubmissions: vi.fn(async () => []),
				submitContact: vi.fn(async () => ({
					ok: true,
					submission: {
						id: "1",
						name: "A",
						email: "a@example.com",
						message: "Hi",
						submittedAt: "now",
					},
				})),
			},
			translations: {
				updateTranslationState: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
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
				saveSettings: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
			},
			rateLimits: {
				checkRateLimit: vi.fn(async () => true),
				peekRateLimit: vi.fn(async () => true),
				recordFailedAttempt: vi.fn(async () => {}),
			},
			media: {
				listMediaAssets: vi.fn(async () => []),
				createMediaAsset: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				updateMediaAsset: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
				deleteMediaAsset: vi.fn(async () => ({
					ok: false,
					error: "not implemented",
				})),
			},
		}));

		expect(await storeModule.getSessionUser("session")).toMatchObject({
			email: "admin@example.com",
		});
		expect(await storeModule.listAdminUsers()).toHaveLength(1);
		expect(getSessionUser).toHaveBeenCalledWith("session");
		expect(listAdminUsers).toHaveBeenCalled();
	});

	it("creates a password auth module from an authenticate function", async () => {
		const authModule = createAstropressPasswordAuthModule(
			async (email, password) => {
				if (email === "admin@example.com" && password === "secret") {
					return { email, role: "admin", name: "Admin" };
				}

				return null;
			},
		);

		await expect(
			authModule.authenticateAdminUser("admin@example.com", "secret"),
		).resolves.toMatchObject({
			email: "admin@example.com",
		});
		await expect(
			authModule.authenticateAdminUser("admin@example.com", "wrong"),
		).resolves.toBeNull();
	});

	it("creates a delegating cms registry module", () => {
		const listSystemRoutes = vi.fn(() => [
			{
				path: "/hello",
				title: "Hello",
				renderStrategy: "generated_text",
				settings: null,
			},
		]);
		const getSystemRoute = vi.fn(() => null);
		const saveSystemRoute = vi.fn(() => ({
			ok: false,
			error: "not implemented",
		}));
		const listStructuredPageRoutes = vi.fn(() => []);
		const getStructuredPageRoute = vi.fn(() => null);
		const saveStructuredPageRoute = vi.fn(() => ({
			ok: false,
			error: "not implemented",
		}));
		const createStructuredPageRoute = vi.fn(() => ({
			ok: false,
			error: "not implemented",
		}));
		const getArchiveRoute = vi.fn(() => null);
		const listArchiveRoutes = vi.fn(() => []);
		const saveArchiveRoute = vi.fn(() => ({
			ok: false,
			error: "not implemented",
		}));

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

	it("creates bootstrap admin users from runtime passwords", () => {
		expect(
			createAstropressBootstrapAdminUsers({
				adminPassword: "admin-secret",
				editorPassword: "editor-secret",
				adminEmail: "admin@example.com",
				adminName: "Test Admin",
				editorEmail: "editor@example.com",
				editorName: "Test Editor",
			}),
		).toEqual([
			{
				email: "admin@example.com",
				password: "admin-secret",
				role: "admin",
				name: "Test Admin",
			},
			{
				email: "editor@example.com",
				password: "editor-secret",
				role: "editor",
				name: "Test Editor",
			},
		]);
	});

	it("creates a combined host runtime bundle", async () => {
		const getStore = vi.fn(() => ({
			backend: "sqlite" as const,
			audit: { getAuditEvents: vi.fn(() => []) },
			auth: {
				createSession: vi.fn(() => "session"),
				getSessionUser: vi.fn(() => ({
					email: "admin@example.com",
					role: "admin" as const,
					name: "Admin",
				})),
				getCsrfToken: vi.fn(() => "csrf"),
				revokeSession: vi.fn(),
				createPasswordResetToken: vi.fn(() => ({
					ok: true as const,
					resetUrl: null,
				})),
				getInviteRequest: vi.fn(() => null),
				getPasswordResetRequest: vi.fn(() => null),
				consumeInviteToken: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				consumePasswordResetToken: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				recordSuccessfulLogin: vi.fn(),
				recordLogout: vi.fn(),
			},
			users: {
				listAdminUsers: vi.fn(() => []),
				inviteAdminUser: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				suspendAdminUser: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				unsuspendAdminUser: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
			authors: {
				listAuthors: vi.fn(() => []),
				createAuthor: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				updateAuthor: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				deleteAuthor: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
			taxonomies: {
				listCategories: vi.fn(() => []),
				createCategory: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				updateCategory: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				deleteCategory: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				listTags: vi.fn(() => []),
				createTag: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				updateTag: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				deleteTag: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
			redirects: {
				getRedirectRules: vi.fn(() => []),
				createRedirectRule: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				deleteRedirectRule: vi.fn(() => ({ ok: false as const })),
			},
			comments: {
				getComments: vi.fn(() => []),
				moderateComment: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				submitPublicComment: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				getApprovedCommentsForRoute: vi.fn(() => []),
			},
			content: {
				listContentStates: vi.fn(() => []),
				getContentState: vi.fn(() => null),
				getContentRevisions: vi.fn(() => null),
				createContentRecord: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				saveContentState: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				restoreRevision: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
			submissions: {
				getContactSubmissions: vi.fn(() => []),
				submitContact: vi.fn(() => ({
					ok: true as const,
					submission: {
						id: "1",
						name: "A",
						email: "a@example.com",
						message: "Hi",
						submittedAt: "now",
					},
				})),
			},
			translations: {
				updateTranslationState: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				getEffectiveTranslationState: vi.fn(() => "draft"),
			},
			settings: {
				getSettings: vi.fn(() => ({
					siteTitle: "Site",
					siteTagline: "Tagline",
					donationUrl: "",
					newsletterEnabled: true,
					commentsDefaultPolicy: "open-moderated" as const,
				})),
				saveSettings: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
			rateLimits: {
				checkRateLimit: vi.fn(() => true),
				peekRateLimit: vi.fn(() => true),
				recordFailedAttempt: vi.fn(),
			},
			media: {
				listMediaAssets: vi.fn(() => []),
				createMediaAsset: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				updateMediaAsset: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
				deleteMediaAsset: vi.fn(() => ({
					ok: false as const,
					error: "not implemented",
				})),
			},
		}));

		const bundle = createAstropressHostRuntimeBundle({
			getStore,
			authenticateAdminUser: async (email, password) =>
				email === "admin@example.com" && password === "secret"
					? { email, role: "admin", name: "Admin" }
					: null,
			cmsRegistry: createAstropressCmsRegistryModule({
				listSystemRoutes: () => [],
				getSystemRoute: () => null,
				saveSystemRoute: () => ({
					ok: false as const,
					error: "not implemented",
				}),
				listStructuredPageRoutes: () => [],
				getStructuredPageRoute: () => null,
				saveStructuredPageRoute: () => ({
					ok: false as const,
					error: "not implemented",
				}),
				createStructuredPageRoute: () => ({
					ok: false as const,
					error: "not implemented",
				}),
				getArchiveRoute: () => null,
				listArchiveRoutes: () => [],
				saveArchiveRoute: () => ({
					ok: false as const,
					error: "not implemented",
				}),
			}),
		});

		expect(
			bundle.localAdminStoreModule.getSessionUser("session"),
		).toMatchObject({
			email: "admin@example.com",
		});
		await expect(
			bundle.localAdminAuthModule.authenticateAdminUser(
				"admin@example.com",
				"secret",
			),
		).resolves.toMatchObject({
			email: "admin@example.com",
		});
		expect(bundle.localCmsRegistryModule.listSystemRoutes()).toEqual([]);
	});
});
