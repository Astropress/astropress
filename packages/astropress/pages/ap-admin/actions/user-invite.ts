import type { APIRoute } from "astro";
import { inviteRuntimeAdminUser } from "astropress";
import { withAdminFormAction } from "astropress";
import { sendUserInviteEmail } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/users", requireAdmin: true }, async ({ actor, formData, locals, request, redirect, fail }) => {
    const result = await inviteRuntimeAdminUser(
      {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? ""),
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error);
    }

    const redirectUrl = new URL("/ap-admin/users", request.url);
    redirectUrl.searchParams.set("saved", "1");

    if (result.inviteUrl) {
      const absoluteInviteUrl = new URL(result.inviteUrl, request.url).toString();
      const emailResult = await sendUserInviteEmail(String(formData.get("email") ?? ""), absoluteInviteUrl, locals);
      if (!emailResult.ok) {
        redirectUrl.searchParams.set("error", "1");
        redirectUrl.searchParams.set("message", emailResult.error ?? "Invitation email failed.");
        return redirect(redirectUrl.pathname + redirectUrl.search);
      }
      if (!import.meta.env.PROD) {
        redirectUrl.searchParams.set("invite_link", result.inviteUrl);
      }
    }

    return redirect(redirectUrl.pathname + redirectUrl.search);
  });
