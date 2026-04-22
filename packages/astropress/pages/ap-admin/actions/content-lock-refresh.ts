import { withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";
import { withLocalStoreFallback } from "../../../src/admin-store-dispatch.js";
import { createD1LocksOps } from "../../../src/d1-locks.js";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin" },
		async ({ formData, locals }) => {
			const slug = String(formData.get("slug") ?? "");
			const lockToken = String(formData.get("lock_token") ?? "");

			const refreshed = await withLocalStoreFallback(
				locals,
				async (db) => createD1LocksOps(db).refreshLock(slug, lockToken),
				async (store) => store.refreshLock?.(slug, lockToken) ?? false,
			);

			return new Response(JSON.stringify({ ok: refreshed }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		},
	);
