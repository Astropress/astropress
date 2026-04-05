import type { APIRoute } from "astro";
import { createRuntimePasswordResetToken } from "astropress";
import { withAdminFormAction } from "astropress";
import { sendPasswordResetEmail } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/users", requireAdmin: true }, async ({ actor, formData, locals, request, redirect, fail }) => {
    const email = String(formData.get("email") ?? "");
    const result = await createRuntimePasswordResetToken(email, actor, locals);

    if (!result.ok) {
      return fail(result.error);
    }

    const redirectUrl = new URL("/wp-admin/users", request.url);
    const absoluteResetUrl = result.resetUrl ? new URL(result.resetUrl, request.url).toString() : null;
    if (result.resetUrl && absoluteResetUrl) {
      const emailResult = await sendPasswordResetEmail(email, absoluteResetUrl, locals);
      if (!emailResult.ok) {
        return fail(emailResult.error ?? "Password reset email failed.");
      }
    }
    if (result.resetUrl) {
      redirectUrl.searchParams.set("reset_link", result.resetUrl);
    }
    return redirect(redirectUrl.pathname + redirectUrl.search);
  });
