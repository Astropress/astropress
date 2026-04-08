import type { APIRoute } from "astro";
import { updateRuntimeMediaAsset } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/media" }, async ({ actor, formData, locals, redirect, fail }) => {
    const result = await updateRuntimeMediaAsset(
      {
        id: String(formData.get("id") ?? ""),
        title: String(formData.get("title") ?? ""),
        altText: String(formData.get("altText") ?? ""),
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/ap-admin/media?saved=1");
  });
