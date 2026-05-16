import { withLocalStoreFallback } from "./admin-store-dispatch";
import { recordD1Audit } from "./d1-audit";
import type { D1DatabaseLike } from "./d1-database";
import type { LocalAdminStoreModule } from "./local-runtime-modules";
import type { Actor } from "./persistence-types";

type MutationResult = { ok: true } | { ok: false; error: string };

export interface TaxonomyAuditMeta {
	action: string;
	resourceId: string;
	message: string;
	onlyIfOk: boolean;
}

export async function runTaxonomyMutation<R extends MutationResult>(
	locals: App.Locals | null | undefined,
	actor: Actor,
	apply: (db: D1DatabaseLike) => R | Promise<R>,
	fallback: (store: LocalAdminStoreModule) => R | Promise<R>,
	audit: TaxonomyAuditMeta,
): Promise<R> {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const result = await apply(db);
			if (audit.onlyIfOk && !result.ok) return result;
			await recordD1Audit(locals, actor, audit.action, "content", audit.resourceId, audit.message);
			return result;
		},
		async (store) => fallback(store),
	);
}
