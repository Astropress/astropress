import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { purgeUserData } from "../../../src/admin-action-user-purge.js";

/**
 * POST /ap-admin/actions/user-purge
 *
 * GDPR right of erasure. Admin-only.
 * Accepts form fields: `email` (required), `deleteAccount` (optional, "1" to delete instead of suspend).
 *
 * Returns a JSON report of all purged/anonymised records — operators should
 * save this for their data-subject-request records.
 */
export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/users", requireAdmin: true }, async ({ formData, locals }) => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const deleteAccount = formData.get("deleteAccount") === "1";
    const result = await purgeUserData(email, locals, { deleteAccount });

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gdpr-purge-${Date.now()}.json"`,
      },
    });
  });
