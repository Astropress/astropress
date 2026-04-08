import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { saveRuntimeSettings } from "astropress";
export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/settings", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const siteTitle = formData.get("siteTitle") as string | null;
    const siteTagline = formData.get("siteTagline") as string | null;
    const donationUrl = formData.get("donationUrl") as string | null;
    const newsletterEnabled = formData.get("newsletterEnabled") === "1";
    const commentsDefaultPolicy = formData.get("commentsDefaultPolicy") as string | null;

    if (!siteTitle || !siteTagline || !donationUrl) {
      return fail("All fields are required");
    }

    const validPolicies = ["disabled", "legacy-readonly", "open-moderated"];
    if (!commentsDefaultPolicy || !validPolicies.includes(commentsDefaultPolicy)) {
      return fail("Invalid comments policy");
    }

    const result = await saveRuntimeSettings(
      {
        siteTitle: siteTitle.trim(),
        siteTagline: siteTagline.trim(),
        donationUrl: donationUrl.trim(),
        newsletterEnabled,
        commentsDefaultPolicy: commentsDefaultPolicy as "disabled" | "legacy-readonly" | "open-moderated",
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail("Failed to save settings");
    }

    return redirect("/ap-admin/settings?saved=1");
  });
