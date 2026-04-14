import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/webhooks", requireAdmin: true }, async ({ formData, redirect, fail }) => {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return fail("Webhook ID is required.");

    const store = await loadLocalAdminStore();
    if (!store.webhooks) return fail("Webhook store is not available.");

    await store.webhooks.delete(id);
    return redirect("/ap-admin/webhooks?deleted=1");
  });
