import type { APIRoute } from "astro";
import { withAdminFormAction, actionRedirect, actionErrorRedirect } from "@astropress-diy/astropress";
import { triggerPublish, resolveDeployHookFromEnv } from "../../../src/admin-action-publish.js";

export const POST: APIRoute = async (context) => {
  return withAdminFormAction(context, { failurePath: "/ap-admin", requireAdmin: true }, async () => {
    const hookConfig = resolveDeployHookFromEnv();

    if (!hookConfig) {
      return actionErrorRedirect("/ap-admin", "No deploy hook is configured. Set a deploy hook environment variable to enable publishing.");
    }

    const result = await triggerPublish(hookConfig);

    if (!result.ok) {
      return actionErrorRedirect("/ap-admin", `Publish failed: ${result.error ?? "Unknown error"}`);
    }

    return actionRedirect("/ap-admin?saved=1");
  });
};
