import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { runMailchimpImport } from "@astropress-diy/astropress/admin-action-mailchimp-import";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(
    context,
    { failurePath: "/ap-admin/settings?tab=newsletter", requireAdmin: true },
    async ({ formData, locals, redirect, fail }) => {
      const file = formData.get("mailchimp_csv") as File | null;
      if (!file || file.size === 0) {
        return fail("Please select a Mailchimp CSV file to upload.");
      }

      const csvText = await file.text();
      const result = await runMailchimpImport(csvText, locals);

      if (!result.ok) {
        return fail(result.error ?? "Import failed.");
      }

      return redirect(
        `/ap-admin/settings?tab=newsletter&imported=${result.imported}&skipped=${result.skipped}`,
      );
    },
  );
