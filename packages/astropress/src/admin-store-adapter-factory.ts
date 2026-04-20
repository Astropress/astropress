import type { AdminStoreAdapter } from "./persistence-types";

type AdminStoreModules = Omit<AdminStoreAdapter, "backend">;

export function createAstropressAdminStoreAdapter(
	backend: AdminStoreAdapter["backend"],
	modules: AdminStoreModules,
): AdminStoreAdapter {
	return {
		backend,
		...modules,
	};
}
