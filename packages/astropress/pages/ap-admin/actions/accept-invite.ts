import type { APIRoute } from "astro";
import {
  consumeRuntimeInviteToken,
  createAstropressSecureRedirect,
  isTrustedStrictRequestOrigin,
} from "@astropress-diy/astropress";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedStrictRequestOrigin(request)) {
    return createAstropressSecureRedirect("/ap-admin/accept-invite?error=1&message=Invalid+request+origin", 302, {
      forceHsts: request.url.startsWith("https://"),
    });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return createAstropressSecureRedirect(
      "/ap-admin/accept-invite?error=1&message=Passwords+must+match.&token=" + encodeURIComponent(token),
      302,
      { forceHsts: request.url.startsWith("https://") },
    );
  }

  const result = await consumeRuntimeInviteToken(token, password, locals);
  if (!result.ok) {
    return createAstropressSecureRedirect(
      "/ap-admin/accept-invite?error=1&message=" + encodeURIComponent(result.error) + "&token=" + encodeURIComponent(token),
      302,
      { forceHsts: request.url.startsWith("https://") },
    );
  }

  return createAstropressSecureRedirect("/ap-admin/login?invited=1", 302, {
    forceHsts: request.url.startsWith("https://"),
  });
};
