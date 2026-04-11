import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { withLocalStoreFallback } from "../../../src/admin-store-dispatch.js";
import { createD1LocksOps } from "../../../src/d1-locks.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin" }, async ({ formData, locals }) => {
    const slug = String(formData.get("slug") ?? "");
    const lockToken = String(formData.get("lock_token") ?? "");

    await withLocalStoreFallback(
      locals,
      async (db) => createD1LocksOps(db).releaseLock(slug, lockToken),
      async (store) => store.releaseLock?.(slug, lockToken),
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
