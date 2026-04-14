import type { APIRoute } from "astro";
import { createRuntimeMediaAsset } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/media" }, async ({ actor, formData, locals, redirect, fail }) => {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("Select a file to upload");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await createRuntimeMediaAsset(
      {
        filename: file.name,
        bytes,
        mimeType: file.type,
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
