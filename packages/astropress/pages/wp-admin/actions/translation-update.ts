import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { updateRuntimeTranslationState } from "astropress";
import { appendQueryParam, resolveSafeReturnPath } from "astropress";

export const POST: APIRoute = async (context) => {
  const fallbackPath = "/wp-admin/translations";
  const refererPath = resolveSafeReturnPath(context.request.headers.get("referer"), fallbackPath);

  return withAdminFormAction(
    context,
    { failurePath: refererPath, unexpectedMessage: "Translation state could not be updated. Please try again." },
    async ({ actor, formData, locals, redirect, fail }) => {
      const returnPath = resolveSafeReturnPath(formData.get("returnPath") as string | null, refererPath);
      const route = formData.get("route") as string | null;
      const state = formData.get("state") as string | null;

      if (!route || !state) {
        return fail("Route and state are required", returnPath);
      }

      const result = await updateRuntimeTranslationState(route, state, actor, locals);
      if (!result.ok) {
        return fail(result.error, returnPath);
      }

      return redirect(appendQueryParam(returnPath, "saved", "1"));
    },
  );
};
