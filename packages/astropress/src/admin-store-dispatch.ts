import type { D1DatabaseLike } from "./d1-database";
import { createD1RateLimitPart } from "./d1-rate-limit-part";
import type { LocalAdminStoreModule } from "./local-runtime-modules";
import { loadLocalAdminStore } from "./local-runtime-modules";
import type { ApiTokenStore, FlashStore, WebhookStore } from "./platform-contracts";
import { getCloudflareBindings } from "./runtime-env";
import { createD1ApiTokenStore } from "./sqlite-runtime/api-tokens-d1";
import { createD1FlashStore } from "./sqlite-runtime/flash-d1";
import { createD1WebhookStore } from "./sqlite-runtime/webhooks-d1";

/** Returns the D1 database binding from request locals, or undefined if not available. */
export function getAdminDb(locals?: App.Locals | null): D1DatabaseLike | undefined {
	return getCloudflareBindings(locals).DB;
}

/**
 * Dispatches to the D1 handler when a database binding is present,
 * or to the local admin store fallback otherwise.
 *
 * This is the single point of dispatch for all admin runtime operations,
 * eliminating the repeated `if (!db) { loadLocalAdminStore() }` pattern.
 */
export async function withLocalStoreFallback<T>(
	locals: App.Locals | null | undefined,
	onD1: (db: D1DatabaseLike) => Promise<T>,
	onLocal: (store: LocalAdminStoreModule) => Promise<T>,
): Promise<T> {
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const localStore = await loadLocalAdminStore();
		return onLocal(localStore);
	}
	return onD1(db);
}

/**
 * Loads the local admin store, returning null if it fails to load.
 * Used in read-only contexts where a missing local store should fall back to static data.
 */
export async function safeLoadLocalAdminStore(): Promise<LocalAdminStoreModule | null> {
	/* v8 ignore next 6 */
	try {
		return await loadLocalAdminStore();
	} catch {
		return null;
	}
}

/**
 * Like withLocalStoreFallback, but catches errors when loading the local store.
 * Used in read-only contexts where a missing local store should return a static fallback.
 */
export async function withSafeLocalStoreFallback<T>(
	locals: App.Locals | null | undefined,
	onD1: (db: D1DatabaseLike) => Promise<T>,
	onLocal: (store: LocalAdminStoreModule | null) => Promise<T>,
): Promise<T> {
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		let localStore: LocalAdminStoreModule | null = null;
		/* v8 ignore next 6 */
		try {
			localStore = await loadLocalAdminStore();
		} catch {
			// local store unavailable — onLocal receives null and handles fallback
		}
		return onLocal(localStore);
	}
	return onD1(db);
}

/**
 * The API-token / webhook / rate-limit surface the REST API and the admin
 * token+webhook pages need, resolved against whichever backend the host
 * provides. `checkRateLimit` is declared as sync-or-async because the D1
 * backend is promise-returning while the local sqlite store is synchronous;
 * `withApiRequest` awaits it either way.
 */
export interface ResolvedApiRuntime {
	apiTokens?: ApiTokenStore;
	webhooks?: WebhookStore;
	checkRateLimit: (key: string, max: number, windowMs: number) => boolean | Promise<boolean>;
}

/**
 * Single dispatch point for the API token + webhook surface. On a D1-backed
 * host it builds the D1 stores; otherwise it uses the local runtime store.
 * Routing every REST/admin token+webhook handler through this resolver is what
 * lets those surfaces work on hosts that provide D1 but not the local runtime
 * alias — see issue #137.
 */
export async function resolveApiRuntime(
	locals: App.Locals | null | undefined,
): Promise<ResolvedApiRuntime> {
	return withLocalStoreFallback(
		locals,
		async (db) => ({
			apiTokens: createD1ApiTokenStore(db),
			webhooks: createD1WebhookStore(db),
			checkRateLimit: createD1RateLimitPart(db).checkRateLimit,
		}),
		async (store) => ({
			apiTokens: store.apiTokens,
			webhooks: store.webhooks,
			checkRateLimit: store.checkRateLimit,
		}),
	);
}

/**
 * Single dispatch point for the one-time flash store, mirroring
 * {@link resolveApiRuntime}. Returns the D1-backed store on hosts that provide
 * a DB binding, the local sqlite store otherwise. The flash store is what lets
 * secret hand-offs (raw API tokens, webhook keys, reset/invite links) survive a
 * POST→redirect→GET round trip without ever appearing in the URL. Returns
 * `undefined` only on DB-less hosts that have no admin store at all — callers
 * surface a typed "unavailable" error in that case. See issues #113/#115/#133.
 */
export async function resolveFlashStore(
	locals: App.Locals | null | undefined,
): Promise<FlashStore | undefined> {
	return withLocalStoreFallback(
		locals,
		async (db) => createD1FlashStore(db),
		async (store) => store.flash,
	);
}
