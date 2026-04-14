import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { createListmonkOps } from "@astropress-diy/astropress/newsletter-adapter";
import { getNewsletterConfig } from "@astropress-diy/astropress/runtime-env";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/subscribers", requireAdmin: true }, async ({ formData, locals, redirect, fail }) => {
    const id = (formData.get("id") as string | null) ?? "";
    if (!id) {
      return fail("Subscriber id is required");
    }

    const cfg = getNewsletterConfig(locals);
    if (
      cfg.mode !== "listmonk" ||
      !cfg.listmonkApiUrl ||
      !cfg.listmonkApiUsername ||
      !cfg.listmonkApiPassword ||
      !cfg.listmonkListId
    ) {
      return fail("Subscriber management requires Listmonk. Check your LISTMONK_* environment variables.");
    }

    const ops = createListmonkOps({
      apiUrl: cfg.listmonkApiUrl,
      apiUsername: cfg.listmonkApiUsername,
      apiPassword: cfg.listmonkApiPassword,
      listId: Number(cfg.listmonkListId),
    });

    const result = await ops.deleteSubscriber(id);
    if (!result.ok) {
      return fail(result.error ?? "Failed to remove subscriber.");
    }

    return redirect("/ap-admin/subscribers?deleted=1");
  });
