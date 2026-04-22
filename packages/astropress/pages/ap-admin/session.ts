import { getLoginSecurityConfig } from "@astropress-diy/astropress";
import {
	authenticateRuntimeAdminUser,
	createAstropressSecureRedirect,
	createRuntimeSession,
	getRuntimeSessionUser,
	recordRuntimeLogout,
	recordRuntimeSuccessfulLogin,
	revokeRuntimeSession,
} from "@astropress-diy/astropress";
import { isTrustedRequestOrigin } from "@astropress-diy/astropress";
import {
	peekRuntimeRateLimit,
	recordRuntimeFailedAttempt,
} from "@astropress-diy/astropress";
import { verifyTurnstileToken } from "@astropress-diy/astropress";
import type { APIRoute, AstroCookies } from "astro";

const LEGACY_SESSION_COOKIE = "ff_admin_session";
const LOCAL_SESSION_COOKIE = "astropress_admin_session";
const SECURE_SESSION_COOKIE = "__Host-astropress_admin_session";

function getSessionCookieName(isSecure: boolean) {
	return isSecure ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

function getSessionToken(cookies: AstroCookies, isSecure: boolean) {
	return (
		cookies.get(getSessionCookieName(isSecure))?.value ??
		cookies.get(LEGACY_SESSION_COOKIE)?.value
	);
}

export const POST: APIRoute = async ({ request, cookies, url, locals }) => {
	try {
		const security = getLoginSecurityConfig(locals);
		const cookieName = getSessionCookieName(security.secureCookies);
		if (url.searchParams.get("logout") === "1") {
			const sessionToken = getSessionToken(cookies, security.secureCookies);
			const user = await getRuntimeSessionUser(sessionToken, locals);
			if (user) {
				await recordRuntimeLogout(user, locals);
				await revokeRuntimeSession(sessionToken, locals);
			}
			cookies.delete(cookieName, { path: "/" });
			cookies.delete(LEGACY_SESSION_COOKIE, { path: "/" });
			return createAstropressSecureRedirect("/ap-admin/login", 302, {
				forceHsts: request.url.startsWith("https://"),
			});
		}

		if (!isTrustedRequestOrigin(request)) {
			return createAstropressSecureRedirect("/ap-admin/login?error=1", 302, {
				forceHsts: request.url.startsWith("https://"),
			});
		}

		const formData = await request.formData();
		const email = String(formData.get("email") ?? "");
		const password = String(formData.get("password") ?? "");
		const turnstileToken = String(formData.get("cf-turnstile-response") ?? "");
		const ipAddress =
			request.headers.get("cf-connecting-ip") ||
			request.headers.get("x-forwarded-for") ||
			"unknown";

		// Check rate limit without incrementing — only failed attempts count toward the limit.
		if (
			!(await peekRuntimeRateLimit(
				`login:${email}`,
				security.maxLoginAttempts,
				60_000,
				locals,
			)) ||
			!(await peekRuntimeRateLimit(
				`login-ip:${ipAddress}`,
				security.maxLoginAttempts * 2,
				60_000,
				locals,
			))
		) {
			return createAstropressSecureRedirect(
				"/ap-admin/login?error=1&ratelimited=1",
				302,
				{
					forceHsts: request.url.startsWith("https://"),
				},
			);
		}

		const challengeResult = await verifyTurnstileToken({
			token: turnstileToken,
			ipAddress,
			locals,
			requireConfigured: true,
		});

		if (!challengeResult.ok) {
			return createAstropressSecureRedirect(
				"/ap-admin/login?error=1&challenge=1",
				302,
				{
					forceHsts: request.url.startsWith("https://"),
				},
			);
		}

		const user = await authenticateRuntimeAdminUser(email, password, locals);

		if (!user) {
			// Only record a failed attempt — successful logins never consume rate-limit quota.
			await recordRuntimeFailedAttempt(
				`login:${email}`,
				security.maxLoginAttempts,
				60_000,
				locals,
			);
			await recordRuntimeFailedAttempt(
				`login-ip:${ipAddress}`,
				security.maxLoginAttempts * 2,
				60_000,
				locals,
			);
			return createAstropressSecureRedirect("/ap-admin/login?error=1", 302, {
				forceHsts: request.url.startsWith("https://"),
			});
		}

		const sessionToken = await createRuntimeSession(
			user,
			{
				ipAddress,
				userAgent: request.headers.get("user-agent"),
			},
			locals,
		);

		cookies.set(cookieName, sessionToken, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: 60 * 60 * 12,
			secure: security.secureCookies,
		});
		cookies.delete(LEGACY_SESSION_COOKIE, { path: "/" });

		await recordRuntimeSuccessfulLogin(user, locals);

		return createAstropressSecureRedirect("/ap-admin", 302, {
			forceHsts: request.url.startsWith("https://"),
		});
	} catch {
		cookies.delete(
			getSessionCookieName(getLoginSecurityConfig(locals).secureCookies),
			{ path: "/" },
		);
		cookies.delete(LEGACY_SESSION_COOKIE, { path: "/" });
		return createAstropressSecureRedirect("/ap-admin/login?error=1", 302, {
			forceHsts: request.url.startsWith("https://"),
		});
	}
};
