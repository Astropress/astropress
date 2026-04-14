import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/api-tokens", requireAdmin: true }, async ({ formData, redirect, fail }) => {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return fail("Token ID is required.");

    const store = await loadLocalAdminStore();
    if (!store.apiTokens) return fail("API token store is not available.");

    await store.apiTokens.revoke(id);
    return redirect("/ap-admin/api-tokens?revoked=1");
  });
