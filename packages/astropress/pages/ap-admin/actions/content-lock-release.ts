import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { withLocalStoreFallback } from "../../../src/admin-store-dispatch.js";
import { createD1LocksOps } from "../../../src/d1-locks.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin" }, async ({ formData, locals }) => {
    const slug = String(formData.get("slug") ?? "");
    const lockToken = String(formData.get("lock_token") ?? "");

    const released = await withLocalStoreFallback(
      locals,
      async (db) => createD1LocksOps(db).releaseLock(slug, lockToken),
      async (store) => store.releaseLock?.(slug, lockToken),
    );

    // released is boolean (true = row deleted) or void/undefined (store didn't report)
    const ok = released !== false;

    return new Response(JSON.stringify({ ok }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
