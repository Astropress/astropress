import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { withLocalStoreFallback } from "../../../src/admin-store-dispatch.js";
import { createD1LocksOps } from "../../../src/d1-locks.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin" }, async ({ actor, formData, locals }) => {
    const slug = String(formData.get("slug") ?? "");
    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await withLocalStoreFallback(
      locals,
      async (db) => createD1LocksOps(db).acquireLock(slug, actor.email, actor.name),
      async (store) => {
        if (!store.acquireLock) {
          return { ok: false as const, error: "Content locking not available" };
        }
        return store.acquireLock(slug, actor.email, actor.name);
      },
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
