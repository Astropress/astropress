import type { APIRoute } from "astro";
import { consumeRuntimeInviteToken } from "astropress";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return redirect("/wp-admin/accept-invite?error=1&message=Passwords+must+match.&token=" + encodeURIComponent(token), 302);
  }

  const result = await consumeRuntimeInviteToken(token, password, locals);
  if (!result.ok) {
    return redirect(
      "/wp-admin/accept-invite?error=1&message=" + encodeURIComponent(result.error) + "&token=" + encodeURIComponent(token),
      302,
    );
  }

  return redirect("/wp-admin/login?invited=1", 302);
};
