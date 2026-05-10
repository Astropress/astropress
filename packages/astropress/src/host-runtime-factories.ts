import {
	ADMIN_STORE_FLAT_METHOD_SECTIONS,
	ADMIN_STORE_SECTIONS,
	type AdminStoreSection,
} from "./host-runtime-factories-data";
import type {
	LocalAdminAuthModule,
	LocalAdminStoreModule,
	LocalCmsRegistryModule,
} from "./local-runtime-modules";
import type { AdminStoreAdapter, SessionUser } from "./persistence-types";

export interface AstropressBootstrapAdminUser {
	email: string;
	role: "admin" | "editor";
	name: string;
	password: string;
}

export interface AstropressBootstrapAdminUsersInput {
	adminPassword?: string;
	editorPassword?: string;
	adminEmail?: string;
	adminName?: string;
	editorEmail?: string;
	editorName?: string;
}

export interface AstropressHostRuntimeBundle {
	localAdminStoreModule: LocalAdminStoreModule;
	localAdminAuthModule: LocalAdminAuthModule;
	localCmsRegistryModule: LocalCmsRegistryModule;
}

export interface AstropressHostRuntimeBundleInput {
	getStore: () => AdminStoreAdapter;
	authenticateAdminUser: (email: string, password: string) => Promise<SessionUser | null>;
	cmsRegistry: LocalCmsRegistryModule;
}

type AnyMethod = (...args: unknown[]) => unknown;

// Lazy section forwarder: every method call re-resolves `getStore()` so the
// returned proxy always targets the current store instance. This preserves
// the per-call lazy semantics of the previous hand-authored factory, where
// the inner section objects re-invoked `getStore()` on each method call.
function createSectionProxy(
	getStore: () => AdminStoreAdapter,
	section: AdminStoreSection,
): AdminStoreAdapter[AdminStoreSection] {
	return new Proxy({} as AdminStoreAdapter[AdminStoreSection], {
		get(_target, prop) {
			if (typeof prop !== "string") return undefined;
			return (...args: unknown[]) => {
				const sectionApi = getStore()[section] as unknown as Record<string, AnyMethod>;
				return sectionApi[prop](...args);
			};
		},
	});
}

export function createAstropressAdminStoreModule(
	getStore: () => AdminStoreAdapter,
): LocalAdminStoreModule {
	return new Proxy({} as LocalAdminStoreModule, {
		get(_target, prop) {
			if (typeof prop !== "string") return undefined;
			if (ADMIN_STORE_SECTIONS.has(prop)) {
				return createSectionProxy(getStore, prop as AdminStoreSection);
			}
			const section = ADMIN_STORE_FLAT_METHOD_SECTIONS[prop];
			if (section === undefined) return undefined;
			return (...args: unknown[]) => {
				const sectionApi = getStore()[section] as unknown as Record<string, AnyMethod>;
				return sectionApi[prop](...args);
			};
		},
	});
}

export function createAstropressPasswordAuthModule(
	authenticateAdminUser: (email: string, password: string) => Promise<SessionUser | null>,
): LocalAdminAuthModule {
	return { authenticateAdminUser };
}

export function createAstropressCmsRegistryModule(
	registry: LocalCmsRegistryModule,
): LocalCmsRegistryModule {
	return new Proxy({} as LocalCmsRegistryModule, {
		get(_target, prop) {
			if (typeof prop !== "string") return undefined;
			const method = (registry as unknown as Record<string, AnyMethod | undefined>)[prop];
			if (typeof method !== "function") return undefined;
			return (...args: unknown[]) => method.apply(registry, args);
		},
	});
}

function requireBootstrapPassword(
	value: string | undefined,
	name: "ADMIN_PASSWORD" | "EDITOR_PASSWORD",
) {
	if (!value) {
		throw new Error(`${name} must be set to enable bootstrap admin authentication.`);
	}

	return value;
}

export function createAstropressBootstrapAdminUsers(
	input: AstropressBootstrapAdminUsersInput,
): AstropressBootstrapAdminUser[] {
	return [
		{
			email: input.adminEmail ?? "admin@example.com",
			password: requireBootstrapPassword(input.adminPassword, "ADMIN_PASSWORD"),
			role: "admin",
			name: input.adminName ?? "Admin",
		},
		{
			email: input.editorEmail ?? "editor@example.com",
			password: requireBootstrapPassword(input.editorPassword, "EDITOR_PASSWORD"),
			role: "editor",
			name: input.editorName ?? "Editor",
		},
	];
}

export function createAstropressHostRuntimeBundle(
	input: AstropressHostRuntimeBundleInput,
): AstropressHostRuntimeBundle {
	return {
		localAdminStoreModule: createAstropressAdminStoreModule(input.getStore),
		localAdminAuthModule: createAstropressPasswordAuthModule(input.authenticateAdminUser),
		localCmsRegistryModule: createAstropressCmsRegistryModule(input.cmsRegistry),
	};
}
