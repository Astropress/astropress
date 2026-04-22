import {
	actionErrorRedirect,
	actionRedirect,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";
import {
	resolveDeployHookFromEnv,
	triggerPublish,
} from "../../../src/admin-action-publish.js";

export const POST: APIRoute = async (context) => {
	return withAdminFormAction(
		context,
		{ failurePath: "/ap-admin", requireAdmin: true },
		async () => {
			const hookConfig = resolveDeployHookFromEnv();

			if (!hookConfig) {
				return actionErrorRedirect(
					"/ap-admin",
					"No deploy hook is configured. Set a deploy hook environment variable to enable publishing.",
				);
			}

			const result = await triggerPublish(hookConfig);

			if (!result.ok) {
				return actionErrorRedirect(
					"/ap-admin",
					`Publish failed: ${result.error ?? "Unknown error"}`,
				);
			}

			const successMessage = result.statusUrl
				? `Build triggered. Track progress: ${result.statusUrl}`
				: "Build triggered. Your production site will update shortly.";

			return actionRedirect("/ap-admin", successMessage);
		},
	);
};
