import type { APIRoute } from "astro";
import { inviteRuntimeAdminUser } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { sendUserInviteEmail } from "@astropress-diy/astropress";

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

    if (result.inviteUrl) {
      const absoluteInviteUrl = new URL(result.inviteUrl, request.url).toString();
      const emailResult = await sendUserInviteEmail(String(formData.get("email") ?? ""), absoluteInviteUrl, locals);
      if (!emailResult.ok) {
        redirectUrl.searchParams.set("error", "1");
        redirectUrl.searchParams.set("message", emailResult.error ?? "Invitation email failed.");
        return redirect(redirectUrl.pathname + redirectUrl.search);
      }
      if (emailResult.delivered) {
        redirectUrl.searchParams.set("saved", "1");
      } else {
        // Email was not actually sent (preview/mock mode) — user was created but no email went out
        redirectUrl.searchParams.set("user_created", "1");
        redirectUrl.searchParams.set("invite_link", result.inviteUrl);
      }
    } else {
      redirectUrl.searchParams.set("saved", "1");
    }

    return redirect(redirectUrl.pathname + redirectUrl.search);
  });
