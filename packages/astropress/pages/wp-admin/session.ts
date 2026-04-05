import type { APIRoute } from "astro";
import { getLoginSecurityConfig } from "astropress";
import {
  authenticateRuntimeAdminUser,
  createRuntimeSession,
  getRuntimeSessionUser,
  recordRuntimeLogout,
  recordRuntimeSuccessfulLogin,
  revokeRuntimeSession,
} from "astropress";
import { peekRuntimeRateLimit, recordRuntimeFailedAttempt } from "astropress";
import { verifyTurnstileToken } from "astropress";

const SESSION_COOKIE = "ff_admin_session";

export const POST: APIRoute = async ({ request, cookies, redirect, url, locals }) => {
  try {
    const security = getLoginSecurityConfig(locals);
    if (url.searchParams.get("logout") === "1") {
      const sessionToken = cookies.get(SESSION_COOKIE)?.value;
      const user = await getRuntimeSessionUser(sessionToken, locals);
      if (user) {
        await recordRuntimeLogout(user, locals);
        await revokeRuntimeSession(sessionToken, locals);
      }
      cookies.delete(SESSION_COOKIE, { path: "/" });
      return redirect("/wp-admin/login", 302);
    }

    const formData = await request.formData();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const turnstileToken = String(formData.get("cf-turnstile-response") ?? "");
    const ipAddress = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";

    // Check rate limit without incrementing — only failed attempts count toward the limit.
    if (
      !(await peekRuntimeRateLimit(`login:${email}`, security.maxLoginAttempts, 60_000, locals)) ||
      !(await peekRuntimeRateLimit(`login-ip:${ipAddress}`, security.maxLoginAttempts * 2, 60_000, locals))
    ) {
      return redirect("/wp-admin/login?error=1&ratelimited=1", 302);
    }

    const challengeResult = await verifyTurnstileToken({
      token: turnstileToken,
      ipAddress,
      locals,
      requireConfigured: true,
    });

    if (!challengeResult.ok) {
      return redirect("/wp-admin/login?error=1&challenge=1", 302);
    }

    const user = await authenticateRuntimeAdminUser(email, password, locals);

    if (!user) {
      // Only record a failed attempt — successful logins never consume rate-limit quota.
      await recordRuntimeFailedAttempt(`login:${email}`, security.maxLoginAttempts, 60_000, locals);
      await recordRuntimeFailedAttempt(`login-ip:${ipAddress}`, security.maxLoginAttempts * 2, 60_000, locals);
      return redirect("/wp-admin/login?error=1", 302);
    }

    const sessionToken = await createRuntimeSession(user, {
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    }, locals);

    cookies.set(SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      secure: security.secureCookies,
    });

    await recordRuntimeSuccessfulLogin(user, locals);

    return redirect("/wp-admin", 302);
  } catch {
    cookies.delete(SESSION_COOKIE, { path: "/" });
    return redirect("/wp-admin/login?error=1", 302);
  }
};
