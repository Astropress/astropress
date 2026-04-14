import type { APIRoute } from "astro";
import { requireAdminFormAction, actionRedirect, actionErrorRedirect } from "@astropress-diy/astropress";
import { triggerPublish, resolveDeployHookFromEnv } from "../../../src/admin-action-publish.js";

export const POST: APIRoute = async (context) => {
  return requireAdminFormAction(context, { requireRole: "admin" }, async () => {
    const hookConfig = resolveDeployHookFromEnv();

    if (!hookConfig) {
      return actionErrorRedirect("/ap-admin", "No deploy hook is configured. Set a deploy hook environment variable to enable publishing.");
    }

    const result = await triggerPublish(hookConfig);

    if (!result.ok) {
      return actionErrorRedirect("/ap-admin", `Publish failed: ${result.error ?? "Unknown error"}`);
    }

    const successMessage = result.statusUrl
      ? `Build triggered. Track progress: ${result.statusUrl}`
      : "Build triggered. Your production site will update shortly.";

    return actionRedirect("/ap-admin", successMessage);
  });
};
