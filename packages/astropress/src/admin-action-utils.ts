import type { APIRoute } from "astro";
import { getRuntimeCsrfToken, getRuntimeSessionUser } from "./runtime-admin-auth";
import { createAstropressSecureRedirect, isTrustedRequestOrigin } from "./security-headers.js";

const SESSION_COOKIE = "ff_admin_session";

type AdminActionContext = Parameters<NonNullable<APIRoute>>[0];
type AdminSessionUser = NonNullable<Awaited<ReturnType<typeof getRuntimeSessionUser>>>;

type GuardOptions = {
  failurePath: string;
  loginPath?: string;
  requireAdmin?: boolean;
  invalidCsrfMessage?: string;
  invalidOriginMessage?: string;
  adminRequiredMessage?: string;
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
  return createAstropressSecureRedirect(location, status, { forceHsts: location.startsWith("https://") });
}

export function actionErrorRedirect(path: string, message: string): Response {
  const url = new URL(path, "https://fleetfarming.local");
  url.searchParams.set("error", "1");
  url.searchParams.set("message", message);
  return actionRedirect(url.pathname + url.search);
}

export async function requireAdminFormAction(
  context: AdminActionContext,
  options: GuardOptions,
): Promise<GuardResult> {
  const sessionToken = context.cookies.get(SESSION_COOKIE)?.value;
  const sessionUser = await getRuntimeSessionUser(sessionToken, context.locals);

  if (!sessionUser) {
    return {
      ok: false,
      response: actionRedirect(options.loginPath ?? "/ap-admin/login"),
    };
  }

  if (options.requireAdmin && sessionUser.role !== "admin") {
    return {
      ok: false,
      response: actionErrorRedirect(options.failurePath, options.adminRequiredMessage ?? "This action requires an admin account."),
    };
  }

  if (!isTrustedRequestOrigin(context.request)) {
    return {
      ok: false,
      response: actionErrorRedirect(options.failurePath, options.invalidOriginMessage ?? "Invalid request origin"),
    };
  }

  const formData = await context.request.formData();
  const expectedToken = await getRuntimeCsrfToken(sessionToken, context.locals);
  const submittedToken = String(formData.get("_csrf") ?? "");

  if (!expectedToken || submittedToken !== expectedToken) {
    return {
      ok: false,
      response: actionErrorRedirect(options.failurePath, options.invalidCsrfMessage ?? "Invalid security token"),
    };
  }

  return { ok: true, sessionUser, formData };
}

export async function withAdminFormAction(
  context: AdminActionContext,
  options: GuardOptions,
  run: (action: ActionContext) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const guarded = await requireAdminFormAction(context, options);
    if (!guarded.ok) {
      return guarded.response;
    }

    const { sessionUser, formData } = guarded;
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
      fail: (message, overridePath) => actionErrorRedirect(overridePath ?? options.failurePath, message),
      redirect: actionRedirect,
    });
  } catch {
    return actionErrorRedirect(options.failurePath, options.unexpectedMessage ?? "Something went wrong. Please try again.");
  }
}
