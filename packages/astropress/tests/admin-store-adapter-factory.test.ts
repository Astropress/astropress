import { describe, expect, it, vi } from "vitest";
import { createAstropressAdminStoreAdapter } from "../src/admin-store-adapter-factory";

describe("admin store adapter factory", () => {
	it("creates an AdminStoreAdapter with the provided backend and modules", async () => {
		const adapter = createAstropressAdminStoreAdapter("sqlite", {
			auth: {
				createSession: vi.fn(() => "session"),
				getSessionUser: vi.fn(async () => null),
				getCsrfToken: vi.fn(async () => null),
				revokeSession: vi.fn(async () => {}),
				createPasswordResetToken: vi.fn(async () => ({
					ok: true,
					resetUrl: null,
				})),
				getInviteRequest: vi.fn(async () => null),
				getPasswordResetRequest: vi.fn(async () => null),
				consumeInviteToken: vi.fn(async () => ({ ok: false, error: "nope" })),
				consumePasswordResetToken: vi.fn(async () => ({
					ok: false,
					error: "nope",
				})),
				recordSuccessfulLogin: vi.fn(async () => {}),
				recordLogout: vi.fn(async () => {}),
			},
			audit: { getAuditEvents: vi.fn(async () => []) },
			users: {
				listAdminUsers: vi.fn(async () => []),
				inviteAdminUser: vi.fn(async () => ({ ok: false, error: "nope" })),
				suspendAdminUser: vi.fn(async () => ({ ok: false, error: "nope" })),
				unsuspendAdminUser: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
			authors: {
				listAuthors: vi.fn(async () => []),
				createAuthor: vi.fn(async () => ({ ok: false, error: "nope" })),
				updateAuthor: vi.fn(async () => ({ ok: false, error: "nope" })),
				deleteAuthor: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
			taxonomies: {
				listCategories: vi.fn(async () => []),
				createCategory: vi.fn(async () => ({ ok: false, error: "nope" })),
				updateCategory: vi.fn(async () => ({ ok: false, error: "nope" })),
				deleteCategory: vi.fn(async () => ({ ok: false, error: "nope" })),
				listTags: vi.fn(async () => []),
				createTag: vi.fn(async () => ({ ok: false, error: "nope" })),
				updateTag: vi.fn(async () => ({ ok: false, error: "nope" })),
				deleteTag: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
			redirects: {
				getRedirectRules: vi.fn(async () => []),
				createRedirectRule: vi.fn(async () => ({ ok: false, error: "nope" })),
				deleteRedirectRule: vi.fn(async () => ({ ok: false })),
			},
			comments: {
				getComments: vi.fn(async () => []),
				moderateComment: vi.fn(async () => ({ ok: false, error: "nope" })),
				submitPublicComment: vi.fn(async () => ({ ok: false, error: "nope" })),
				getApprovedCommentsForRoute: vi.fn(async () => []),
			},
			content: {
				listContentStates: vi.fn(async () => []),
				getContentState: vi.fn(async () => null),
				getContentRevisions: vi.fn(async () => null),
				createContentRecord: vi.fn(async () => ({ ok: false, error: "nope" })),
				saveContentState: vi.fn(async () => ({ ok: false, error: "nope" })),
				restoreRevision: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
			submissions: {
				submitContact: vi.fn(async () => ({
					ok: true,
					submission: {
						id: "1",
						name: "A",
						email: "a@example.com",
						message: "x",
						submittedAt: "now",
					},
				})),
				getContactSubmissions: vi.fn(async () => []),
			},
			translations: {
				updateTranslationState: vi.fn(async () => ({
					ok: false,
					error: "nope",
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
				saveSettings: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
			rateLimits: {
				checkRateLimit: vi.fn(async () => true),
				peekRateLimit: vi.fn(async () => true),
				recordFailedAttempt: vi.fn(async () => {}),
			},
			media: {
				listMediaAssets: vi.fn(async () => []),
				createMediaAsset: vi.fn(async () => ({ ok: false, error: "nope" })),
				updateMediaAsset: vi.fn(async () => ({ ok: false, error: "nope" })),
				deleteMediaAsset: vi.fn(async () => ({ ok: false, error: "nope" })),
			},
		});

		expect(adapter.backend).toBe("sqlite");
		await expect(adapter.audit.getAuditEvents()).resolves.toEqual([]);
	});
});
