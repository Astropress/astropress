import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { saveRuntimeSystemRoute } from "astropress";

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/system", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const path = String(formData.get("path") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    const bodyHtml = String(formData.get("bodyHtml") ?? "");
    const revisionNote = String(formData.get("revisionNote") ?? "").trim();

    if (!path || !title) {
      return fail("System route path and title are required");
    }

    let settings: Record<string, unknown> | null = null;
    if (path === "/500") {
      settings = {
        buttonLabel: String(formData.get("buttonLabel") ?? "").trim() || "Go to homepage",
        buttonHref: String(formData.get("buttonHref") ?? "").trim() || "/",
        contactHref: String(formData.get("contactHref") ?? "").trim() || "/en/contact-fleet-farming",
      };
    } else if (path === "/sitemap.xml") {
      settings = {
        excludedPaths: splitLines(formData.get("excludedPaths")),
        extraUrls: splitLines(formData.get("extraUrls")),
      };
    }

    const result = await saveRuntimeSystemRoute(
      path,
      {
        title,
        summary,
        bodyHtml,
        settings,
        revisionNote,
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/ap-admin/system?saved=1");
  });
