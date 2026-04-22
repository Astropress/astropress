import type { D1DatabaseLike } from "./d1-database";
import type { LocalAdminStoreModule } from "./local-runtime-modules";
import { loadLocalAdminStore } from "./local-runtime-modules";
import { getCloudflareBindings } from "./runtime-env";

/** Returns the D1 database binding from request locals, or undefined if not available. */
export function getAdminDb(
	locals?: App.Locals | null,
): D1DatabaseLike | undefined {
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
