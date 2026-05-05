import type { APIRoute } from "astro";
import { logAccessDeny } from "./access/audit-deny.js";
import { getAccessContext } from "./access/index.js";
import {
	ADMIN_ACTION_LOGGER_CONTEXT,
	DEFAULT_ACTION_DENIED_MESSAGE,
	DEFAULT_ADMIN_REQUIRED_MESSAGE,
	DEFAULT_INVALID_CSRF_MESSAGE,
	DEFAULT_INVALID_ORIGIN_MESSAGE,
	DEFAULT_LOGIN_PATH,
	DEFAULT_UNEXPECTED_MESSAGE,
	LEGACY_SESSION_COOKIE,
	LOCAL_SESSION_COOKIE,
	SECURE_SESSION_COOKIE,
} from "./admin-action-utils-data";
import { isAuthUserAdmin } from "./platform-contracts.js";
import {
	getRuntimeCsrfToken,
	getRuntimeSessionUser,
} from "./runtime-admin-auth";
import { getLoginSecurityConfig, getRuntimeEnv } from "./runtime-env.js";
import { createLogger } from "./runtime-logger.js";
import {
	createAstropressSecureRedirect,
	isTrustedRequestOrigin,
} from "./security-headers.js";

const logger = createLogger(ADMIN_ACTION_LOGGER_CONTEXT);

type AdminActionContext = Parameters<NonNullable<APIRoute>>[0];
type AdminSessionUser = NonNullable<
	Awaited<ReturnType<typeof getRuntimeSessionUser>>
>;

type GuardOptions = {
	failurePath: string;
	loginPath?: string;
	requireAdmin?: boolean;
	/**
	 * ABAC action ID required to run this handler. When set, the access
	 * engine evaluates `can(requireAction)` against the session subject;
	 * a deny short-circuits the request with `actionRequiredMessage` (or
	 * the engine's reason). Admins bypass evaluation by definition.
	 */
	requireAction?: string;
	invalidCsrfMessage?: string;
	invalidOriginMessage?: string;
	adminRequiredMessage?: string;
	actionDeniedMessage?: string;
	unexpectedMessage?: string;
};

type GuardResult =
	| { ok: true; sessionUser: AdminSessionUser; formData: FormData }
	| { ok: false; response: Response };

type ActionContext = {
	sessionUser: AdminSessionUser;
	actor: { email: string; role: AdminSessionUser["role"]; name: string };
	formData: FormData;
	locals: AdminActionContext["locals"];
	request: Request;
	fail: (message: string, overridePath?: string) => Response;
	redirect: (location: string, status?: number) => Response;
};

export function actionRedirect(location: string, status = 302): Response {
	return createAstropressSecureRedirect(location, status, {
		forceHsts: location.startsWith("https://"),
	});
}

export function actionErrorRedirect(path: string, message: string): Response {
	const url = new URL(path, "https://astropress.invalid");
	url.searchParams.set("error", "1");
	url.searchParams.set("message", message);
	return actionRedirect(url.pathname + url.search);
}

async function checkActionPermission(
	context: AdminActionContext,
	options: GuardOptions,
	sessionUser: { email: string },
): Promise<Response | null> {
	if (!options.requireAction) return null;
	const access = await getAccessContext({ locals: context.locals });
	const decision = access?.can(options.requireAction);
	if (decision && decision.decision !== "deny") return null;
	if (decision) {
		await logAccessDeny(context.locals, {
			subjectEmail: access?.subject.email ?? sessionUser.email,
			action: options.requireAction,
			decision,
		});
	}
	return actionErrorRedirect(
		options.failurePath,
		options.actionDeniedMessage ??
			decision?.reason ??
			DEFAULT_ACTION_DENIED_MESSAGE,
	);
}

async function checkCsrf(
	context: AdminActionContext,
	options: GuardOptions,
	sessionToken: string | undefined,
	formData: FormData,
): Promise<Response | null> {
	const expectedToken =
		(await getRuntimeCsrfToken(sessionToken, context.locals)) ??
		(getRuntimeEnv("PLAYWRIGHT_E2E_MODE") === "admin-harness"
			? (context.locals.csrfToken ?? null)
			: null);
	const submittedToken = String(formData.get("_csrf") ?? "");
	if (expectedToken && submittedToken === expectedToken) return null;
	return actionErrorRedirect(
		options.failurePath,
		options.invalidCsrfMessage ?? DEFAULT_INVALID_CSRF_MESSAGE,
	);
}

export async function requireAdminFormAction(
	context: AdminActionContext,
	options: GuardOptions,
): Promise<GuardResult> {
	const secureCookies = getLoginSecurityConfig(context.locals).secureCookies;
	const sessionCookieName = secureCookies
		? SECURE_SESSION_COOKIE
		: LOCAL_SESSION_COOKIE;
	const sessionToken =
		context.cookies.get(sessionCookieName)?.value ??
		context.cookies.get(LEGACY_SESSION_COOKIE)?.value;
	const harnessSessionUser =
		getRuntimeEnv("PLAYWRIGHT_E2E_MODE") === "admin-harness"
			? context.locals.adminUser
			: null;
	const sessionUser =
		(await getRuntimeSessionUser(sessionToken, context.locals)) ??
		harnessSessionUser;

	if (!sessionUser) {
		return {
			ok: false,
			response: actionRedirect(options.loginPath ?? DEFAULT_LOGIN_PATH),
		};
	}

	if (options.requireAdmin && !isAuthUserAdmin(sessionUser)) {
		return {
			ok: false,
			response: actionErrorRedirect(
				options.failurePath,
				options.adminRequiredMessage ?? DEFAULT_ADMIN_REQUIRED_MESSAGE,
			),
		};
	}

	const denyResponse = await checkActionPermission(
		context,
		options,
		sessionUser,
	);
	if (denyResponse) return { ok: false, response: denyResponse };

	if (!isTrustedRequestOrigin(context.request)) {
		return {
			ok: false,
			response: actionErrorRedirect(
				options.failurePath,
				options.invalidOriginMessage ?? DEFAULT_INVALID_ORIGIN_MESSAGE,
			),
		};
	}

	const formData = await context.request.formData();
	const csrfFailure = await checkCsrf(context, options, sessionToken, formData);
	if (csrfFailure) return { ok: false, response: csrfFailure };

	return { ok: true, sessionUser, formData };
}

export async function withAdminFormAction(
	context: AdminActionContext,
	options: GuardOptions,
	run: (action: ActionContext) => Promise<Response> | Response,
): Promise<Response> {
	const actionPath = new URL(context.request.url).pathname;
	try {
		const guarded = await requireAdminFormAction(context, options);
		if (!guarded.ok) {
			return guarded.response;
		}

		const { sessionUser, formData } = guarded;
		logger.info("admin action", {
			path: actionPath,
			actor: sessionUser.email,
			role: sessionUser.role,
		});
		return await run({
			sessionUser,
			actor: {
				email: sessionUser.email,
				role: sessionUser.role,
				name: sessionUser.name,
			},
			formData,
			locals: context.locals,
			request: context.request,
			fail: (message, overridePath) => {
				logger.warn("admin action failed", {
					path: actionPath,
					actor: sessionUser.email,
					message,
				});
				return actionErrorRedirect(
					overridePath ?? options.failurePath,
					message,
				);
			},
			redirect: actionRedirect,
		});
	} catch (err) {
		logger.error("admin action error", {
			path: actionPath,
			error: String(err),
		});
		return actionErrorRedirect(
			options.failurePath,
			options.unexpectedMessage ?? DEFAULT_UNEXPECTED_MESSAGE,
		);
	}
}
