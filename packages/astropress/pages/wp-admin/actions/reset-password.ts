import type { APIRoute } from "astro";
import {
  consumeRuntimePasswordResetToken,
  createAstropressSecureRedirect,
  createRuntimePasswordResetToken,
  isTrustedRequestOrigin,
} from "astropress";
import { sendPasswordResetEmail } from "astropress";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedRequestOrigin(request)) {
    return createAstropressSecureRedirect("/wp-admin/reset-password?error=1&message=Invalid+request+origin", 302, {
      forceHsts: request.url.startsWith("https://"),
    });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");

  if (token) {
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      return createAstropressSecureRedirect(
        "/wp-admin/reset-password?error=1&message=Passwords+must+match.&token=" + encodeURIComponent(token),
        302,
        { forceHsts: request.url.startsWith("https://") },
      );
    }

    const result = await consumeRuntimePasswordResetToken(token, password, locals);
    if (!result.ok) {
      return createAstropressSecureRedirect(
        "/wp-admin/reset-password?error=1&message=" + encodeURIComponent(result.error) + "&token=" + encodeURIComponent(token),
        302,
        { forceHsts: request.url.startsWith("https://") },
      );
    }

    return createAstropressSecureRedirect("/wp-admin/login?reset=1", 302, {
      forceHsts: request.url.startsWith("https://"),
    });
  }

  const email = String(formData.get("email") ?? "");
  const result = await createRuntimePasswordResetToken(email, null, locals);
  const redirectUrl = new URL("/wp-admin/reset-password", request.url);
  redirectUrl.searchParams.set("mail_sent", "1");

  if (result.ok && result.resetUrl) {
    const absoluteResetUrl = new URL(result.resetUrl, request.url).toString();
    const emailResult = await sendPasswordResetEmail(email, absoluteResetUrl, locals);
    if (!emailResult.ok) {
      redirectUrl.searchParams.set("error", "1");
      redirectUrl.searchParams.set("message", emailResult.error ?? "Password reset email failed.");
    }
  }

  if (!import.meta.env.PROD && result.ok && result.resetUrl) {
    redirectUrl.searchParams.set("reset_link", result.resetUrl);
  }

  return createAstropressSecureRedirect(redirectUrl.pathname + redirectUrl.search, 302, {
    forceHsts: request.url.startsWith("https://"),
  });
};
