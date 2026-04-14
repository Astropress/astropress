import type { APIRoute } from "astro";
import {
  consumeRuntimePasswordResetToken,
  createAstropressSecureRedirect,
  createRuntimePasswordResetToken,
  isTrustedRequestOrigin,
} from "@astropress-diy/astropress";
import { sendPasswordResetEmail } from "@astropress-diy/astropress";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedRequestOrigin(request)) {
    return createAstropressSecureRedirect("/ap-admin/reset-password?error=1&message=Invalid+request+origin", 302, {
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
        "/ap-admin/reset-password?error=1&message=Passwords+must+match.&token=" + encodeURIComponent(token),
        302,
        { forceHsts: request.url.startsWith("https://") },
      );
    }

    const result = await consumeRuntimePasswordResetToken(token, password, locals);
    if (!result.ok) {
      return createAstropressSecureRedirect(
        "/ap-admin/reset-password?error=1&message=" + encodeURIComponent(result.error) + "&token=" + encodeURIComponent(token),
        302,
        { forceHsts: request.url.startsWith("https://") },
      );
    }

    return createAstropressSecureRedirect("/ap-admin/login?reset=1", 302, {
      forceHsts: request.url.startsWith("https://"),
    });
  }

  const email = String(formData.get("email") ?? "");
  const result = await createRuntimePasswordResetToken(email, null, locals);
  const redirectUrl = new URL("/ap-admin/reset-password", request.url);

  if (result.ok && result.resetUrl) {
    const absoluteResetUrl = new URL(result.resetUrl, request.url).toString();
    const emailResult = await sendPasswordResetEmail(email, absoluteResetUrl, locals);
    if (!emailResult.ok) {
      // Email failed in production — tell the user clearly rather than falsely claiming success
      redirectUrl.searchParams.set("error", "1");
      redirectUrl.searchParams.set("message", emailResult.error ?? "Password reset email could not be sent. Verify SMTP or Resend settings, then contact support if delivery is still blocked.");
    } else {
      // Email sent (or simulated in dev) — show the intentionally-vague anti-enumeration message
      redirectUrl.searchParams.set("mail_sent", "1");
    }
    if (!import.meta.env.PROD) {
      redirectUrl.searchParams.set("reset_link", result.resetUrl);
    }
  } else {
    // No account found (or token creation failed) — still show the same vague message to prevent enumeration
    redirectUrl.searchParams.set("mail_sent", "1");
  }

  return createAstropressSecureRedirect(redirectUrl.pathname + redirectUrl.search, 302, {
    forceHsts: request.url.startsWith("https://"),
  });
};
