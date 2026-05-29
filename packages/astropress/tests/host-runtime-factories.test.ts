import { describe, expect, it, vi } from "vitest";
import {
	createAstropressAdminStoreModule,
	createAstropressBootstrapAdminUsers,
	createAstropressCmsRegistryModule,
	createAstropressHostRuntimeBundle,
	createAstropressPasswordAuthModule,
} from "../src/host-runtime-factories";
import {
	ADMIN_STORE_FLAT_METHOD_SECTIONS,
	ADMIN_STORE_OPTIONAL_OBJECT_KEYS,
	ADMIN_STORE_SECTIONS,
} from "../src/host-runtime-factories-data";
import type { AdminStoreAdapter } from "../src/persistence-types";

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
		const authModule = createAstropressPasswordAuthModule(async (email, password) => {
			if (email === "admin@example.com" && password === "secret") {
				return { email, role: "admin", name: "Admin" };
			}

			return null;
		});

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

	it("throws referencing ADMIN_PASSWORD when adminPassword is missing", () => {
		expect(() => createAstropressBootstrapAdminUsers({ editorPassword: "editor-secret" })).toThrow(
			/ADMIN_PASSWORD/,
		);
	});

	it("throws referencing EDITOR_PASSWORD when editorPassword is missing", () => {
		expect(() => createAstropressBootstrapAdminUsers({ adminPassword: "admin-secret" })).toThrow(
			/EDITOR_PASSWORD/,
		);
	});

	it("applies default emails and names when only passwords are supplied", () => {
		expect(
			createAstropressBootstrapAdminUsers({
				adminPassword: "admin-secret",
				editorPassword: "editor-secret",
			}),
		).toEqual([
			{
				email: "admin@example.com",
				password: "admin-secret",
				role: "admin",
				name: "Admin",
			},
			{
				email: "editor@example.com",
				password: "editor-secret",
				role: "editor",
				name: "Editor",
			},
		]);
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

		expect(bundle.localAdminStoreModule.getSessionUser("session")).toMatchObject({
			email: "admin@example.com",
		});
		await expect(
			bundle.localAdminAuthModule.authenticateAdminUser("admin@example.com", "secret"),
		).resolves.toMatchObject({
			email: "admin@example.com",
		});
		expect(bundle.localCmsRegistryModule.listSystemRoutes()).toEqual([]);
	});
});

describe("createAstropressAdminStoreModule (Proxy semantics)", () => {
	type Call = { section: string; method: string; args: unknown[] };
	const buildFakeStore = (calls: Call[]): AdminStoreAdapter =>
		new Proxy({} as AdminStoreAdapter, {
			get(_target, section) {
				if (typeof section !== "string") return undefined;
				return new Proxy(
					{},
					{
						get(_t, method) {
							if (typeof method !== "string") return undefined;
							return (...args: unknown[]) => {
								calls.push({ section, method, args });
								return `${section}.${method}::${JSON.stringify(args)}`;
							};
						},
					},
				);
			},
		}) as AdminStoreAdapter;

	it("forwards every flat method to its declared section with full arg list", () => {
		const calls: Call[] = [];
		const storeModule = createAstropressAdminStoreModule(() => buildFakeStore(calls));
		for (const [method, expectedSection] of Object.entries(ADMIN_STORE_FLAT_METHOD_SECTIONS)) {
			const fn = (storeModule as unknown as Record<string, (...a: unknown[]) => unknown>)[method];
			expect(typeof fn).toBe("function");
			const result = fn("alpha", 42, { nested: true });
			expect(result).toBe(`${expectedSection}.${method}::["alpha",42,{"nested":true}]`);
		}
		expect(calls).toHaveLength(Object.keys(ADMIN_STORE_FLAT_METHOD_SECTIONS).length);
		for (const c of calls) {
			expect(c.args).toEqual(["alpha", 42, { nested: true }]);
			expect(ADMIN_STORE_FLAT_METHOD_SECTIONS[c.method]).toBe(c.section);
		}
	});

	it("exposes each declared section as a lazy proxy that forwards by method name", () => {
		const calls: Call[] = [];
		const storeModule = createAstropressAdminStoreModule(() => buildFakeStore(calls));
		for (const section of ADMIN_STORE_SECTIONS) {
			const sectionApi = (
				storeModule as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>
			)[section];
			expect(typeof sectionApi).toBe("object");
			const result = sectionApi.someProbeMethod("x");
			expect(result).toBe(`${section}.someProbeMethod::["x"]`);
			// The inner section proxy must also reject non-string keys: a symbol
			// access returns undefined, not a (truthy) forwarding function.
			expect((sectionApi as unknown as { [k: symbol]: unknown })[Symbol.iterator]).toBeUndefined();
		}
	});

	it("forwards optional object surfaces by value so absence stays falsy", () => {
		// Regression for the latent local-mode bug: apiTokens/webhooks/flash/
		// integrations must be reachable through the flattened module (a section
		// proxy would always be truthy and break the `if (!store.apiTokens)`
		// absence guard that DB-less hosts rely on). See issues #137 and
		// #113/#115/#133.
		const present = {
			apiTokens: { marker: "T" },
			webhooks: { marker: "W" },
			flash: { marker: "F" },
		};
		const withStores = createAstropressAdminStoreModule(
			() => present as unknown as AdminStoreAdapter,
		);
		expect((withStores as unknown as Record<string, unknown>).apiTokens).toBe(present.apiTokens);
		expect((withStores as unknown as Record<string, unknown>).webhooks).toBe(present.webhooks);
		expect((withStores as unknown as Record<string, unknown>).flash).toBe(present.flash);

		const empty = createAstropressAdminStoreModule(() => ({}) as unknown as AdminStoreAdapter);
		for (const key of ADMIN_STORE_OPTIONAL_OBJECT_KEYS) {
			expect((empty as unknown as Record<string, unknown>)[key]).toBeUndefined();
		}
	});

	it("returns undefined for unknown property names and for symbol keys", () => {
		const calls: Call[] = [];
		const storeModule = createAstropressAdminStoreModule(() => buildFakeStore(calls));
		expect((storeModule as unknown as Record<string, unknown>).notARealMethod).toBeUndefined();
		expect(
			(storeModule as unknown as Record<string, unknown>).getApprovedCommentsForRoute,
		).toBeUndefined();
		expect((storeModule as unknown as { [k: symbol]: unknown })[Symbol.iterator]).toBeUndefined();
	});

	it("re-resolves getStore() on every flat-method call (no snapshot at access time)", () => {
		const calls: Call[] = [];
		let active = 0;
		const stores = [buildFakeStore(calls), buildFakeStore(calls)];
		const storeModule = createAstropressAdminStoreModule(() => stores[active] as AdminStoreAdapter);
		const getSettings = (storeModule as unknown as { getSettings: (...a: unknown[]) => unknown })
			.getSettings;
		getSettings("first");
		active = 1;
		getSettings("second");
		expect(calls.map((c) => c.args[0])).toEqual(["first", "second"]);
	});

	it("re-resolves getStore() on every nested-section method call", () => {
		const calls: Call[] = [];
		let active = 0;
		const stores = [buildFakeStore(calls), buildFakeStore(calls)];
		const storeModule = createAstropressAdminStoreModule(() => stores[active] as AdminStoreAdapter);
		const settingsSection = (
			storeModule as unknown as { settings: { getSettings: (...a: unknown[]) => unknown } }
		).settings;
		settingsSection.getSettings("first");
		active = 1;
		settingsSection.getSettings("second");
		expect(calls.map((c) => c.args[0])).toEqual(["first", "second"]);
	});

	it("does not expose getApprovedCommentsForRoute as a flat method (nested-only)", () => {
		const calls: Call[] = [];
		const storeModule = createAstropressAdminStoreModule(() => buildFakeStore(calls));
		expect(
			(storeModule as unknown as Record<string, unknown>).getApprovedCommentsForRoute,
		).toBeUndefined();
		const commentsSection = (
			storeModule as unknown as {
				comments: { getApprovedCommentsForRoute: (...a: unknown[]) => unknown };
			}
		).comments;
		expect(commentsSection.getApprovedCommentsForRoute("/path")).toBe(
			'comments.getApprovedCommentsForRoute::["/path"]',
		);
	});
});

describe("createAstropressCmsRegistryModule (Proxy semantics)", () => {
	it("forwards every method on the underlying registry with the original arguments", () => {
		const calls: Array<{ method: string; args: unknown[] }> = [];
		const make = (method: string) =>
			vi.fn((...args: unknown[]) => {
				calls.push({ method, args });
				return `${method}::${JSON.stringify(args)}`;
			});
		const registry = {
			listSystemRoutes: make("listSystemRoutes"),
			getSystemRoute: make("getSystemRoute"),
			saveSystemRoute: make("saveSystemRoute"),
			listStructuredPageRoutes: make("listStructuredPageRoutes"),
			getStructuredPageRoute: make("getStructuredPageRoute"),
			saveStructuredPageRoute: make("saveStructuredPageRoute"),
			createStructuredPageRoute: make("createStructuredPageRoute"),
			getArchiveRoute: make("getArchiveRoute"),
			listArchiveRoutes: make("listArchiveRoutes"),
			saveArchiveRoute: make("saveArchiveRoute"),
		} as unknown as Parameters<typeof createAstropressCmsRegistryModule>[0];
		const module = createAstropressCmsRegistryModule(registry);
		const moduleRecord = module as unknown as Record<string, (...a: unknown[]) => unknown>;
		for (const method of Object.keys(registry as Record<string, unknown>)) {
			const result = moduleRecord[method]("arg1", { z: 9 });
			expect(result).toBe(`${method}::${JSON.stringify(["arg1", { z: 9 }])}`);
		}
		expect(calls.map((c) => c.method).sort()).toEqual(
			Object.keys(registry as Record<string, unknown>).sort(),
		);
		for (const c of calls) {
			expect(c.args).toEqual(["arg1", { z: 9 }]);
		}
	});

	it("returns undefined for unknown property names, symbol keys, and non-function members", () => {
		const registry = {
			listSystemRoutes: () => [],
			getSystemRoute: () => null,
			saveSystemRoute: () => ({ ok: false as const, error: "x" }),
			listStructuredPageRoutes: () => [],
			getStructuredPageRoute: () => null,
			saveStructuredPageRoute: () => ({ ok: false as const, error: "x" }),
			createStructuredPageRoute: () => ({ ok: false as const, error: "x" }),
			getArchiveRoute: () => null,
			listArchiveRoutes: () => [],
			saveArchiveRoute: () => ({ ok: false as const, error: "x" }),
		};
		const module = createAstropressCmsRegistryModule(registry);
		const asRecord = module as unknown as Record<string, unknown>;
		expect(asRecord.notARealMethod).toBeUndefined();
		expect((module as unknown as { [k: symbol]: unknown })[Symbol.iterator]).toBeUndefined();
		// Inject a non-function-valued property; the Proxy must still return undefined
		// rather than the raw value, otherwise consumers hit "is not a function" errors
		// at the call site.
		const registryWithExtra = Object.assign({}, registry, {
			description: "static metadata, not a callable",
		});
		const moduleWithExtra = createAstropressCmsRegistryModule(
			registryWithExtra as unknown as typeof registry,
		);
		expect((moduleWithExtra as unknown as Record<string, unknown>).description).toBeUndefined();
	});
});
