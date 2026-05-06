/**
 * Per-request access context.
 *
 * Resolves the active subject (id, email, isAdmin, roles, attributes) plus
 * the union of role + direct policies into a snapshot, then constructs a
 * synchronous PolicyEngine that closes over that snapshot. The result is
 * cached on `Astro.locals.access` so a single request only pays the load
 * cost once.
 *
 * Two storage paths are supported via `withLocalStoreFallback`:
 *  - Cloudflare D1: async snapshot loader in `d1-access-store.ts`.
 *  - Local sync sqlite: optional `access` extension on LocalAdminStoreModule.
 *    When the host app has not yet wired it (older consumers, harness),
 *    we degrade gracefully to an admin-only snapshot derived from
 *    `locals.adminUser` — admins bypass policy evaluation, so this keeps
 *    the runtime usable while consumers migrate.
 */

import { withLocalStoreFallback } from "../admin-store-dispatch";
import type { LocalAdminStoreModule } from "../local-runtime-modules";
import type { AuthUser } from "../platform-contracts";
import { isAuthUserAdmin } from "../platform-contracts";
import type { AccessSnapshot } from "./d1-access-store";
import { loadAccessSnapshotFromD1 } from "./d1-access-store";

export type { AccessSnapshot } from "./d1-access-store";

import { createPolicyEngine } from "./engine";
import type { Env, EvaluationResult, PolicyEngine, Resource, Subject } from "./types";

export interface AccessContext {
	subject: Subject;
	engine: PolicyEngine;
	can: (action: string, resource?: Resource, env?: Env) => EvaluationResult;
}

/**
 * Optional access surface that local sqlite admin stores can implement.
 * Cloudflare's D1 path goes through `d1-access-store.ts`; this interface is
 * what the in-process sync store provides.
 */
export interface LocalAccessStoreSurface {
	resolveAccessSnapshotByEmail(email: string): AccessSnapshot | null;
}

/**
 * Lazy resolver. Returns null when there is no authenticated admin user on
 * locals. Caches the resolved AccessContext on `locals.access` for the rest
 * of the request.
 */
export async function getAccessContext(astro: {
	locals: App.Locals;
}): Promise<AccessContext | null> {
	const locals = astro.locals as App.Locals & {
		access?: AccessContext;
		adminUser?: AuthUser & { name?: string };
	};
	if (locals.access) return locals.access;

	const adminUser = locals.adminUser;
	if (!adminUser?.email) return null;

	const snapshot = await loadAccessSnapshot(locals, adminUser);
	const ctx = buildContext(snapshot, adminUser);
	locals.access = ctx;
	return ctx;
}

function buildContext(snap: AccessSnapshot, user: AuthUser): AccessContext {
	const subject: Subject = {
		id: snap.userId,
		email: user.email,
		isAdmin: snap.isAdmin,
		roles: snap.roles,
		attributes: snap.attributes,
	};
	const engine = createPolicyEngine({
		resolvePoliciesForSubject: () => snap.policies,
	});
	return {
		subject,
		engine,
		can: (action, resource, env) => engine.can(subject, action, resource, env),
	};
}

async function loadAccessSnapshot(
	locals: App.Locals | null | undefined,
	adminUser: AuthUser,
): Promise<AccessSnapshot> {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const fromD1 = await loadAccessSnapshotFromD1(db, adminUser.email);
			if (fromD1) {
				// Honour the legacy admin flag too — covers DBs whose is_admin
				// migration hasn't run yet.
				return {
					...fromD1,
					isAdmin: fromD1.isAdmin || isAuthUserAdmin(adminUser),
				};
			}
			return adminOnlySnapshot(adminUser);
		},
		(store) => Promise.resolve(loadFromLocal(store, adminUser)),
	);
}

function loadFromLocal(store: LocalAdminStoreModule, adminUser: AuthUser): AccessSnapshot {
	const surface = (store as unknown as { access?: LocalAccessStoreSurface }).access;
	const fromStore = surface?.resolveAccessSnapshotByEmail(adminUser.email);
	if (fromStore) {
		const isAdmin = fromStore.isAdmin || isAuthUserAdmin(adminUser);
		return { ...fromStore, isAdmin };
	}
	return adminOnlySnapshot(adminUser);
}

function adminOnlySnapshot(adminUser: AuthUser): AccessSnapshot {
	return {
		userId: adminUser.id ?? `email:${adminUser.email}`,
		isAdmin: isAuthUserAdmin(adminUser),
		roles: [],
		attributes: {},
		policies: [],
	};
}
