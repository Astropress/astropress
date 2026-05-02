import {
	disconnectIntegrationAction,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { IntegrationDomain } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

const ALLOWED_DOMAINS: ReadonlySet<IntegrationDomain> = new Set([
	"newsletter",
	"analytics",
	"ab-testing",
	"search",
	"cdn-purge",
	"monitoring",
	"forms",
	"deploy-hooks",
]);

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{
			failurePath: "/ap-admin/services",
			requireAction: "services:manage",
		},
		async ({ formData, locals, redirect, fail }) => {
			const domain = String(formData.get("domain") ?? "").trim();
			const providerId = String(formData.get("providerId") ?? "").trim();
			if (!domain || !providerId) {
				return fail("Missing domain or providerId.");
			}
			if (!ALLOWED_DOMAINS.has(domain as IntegrationDomain)) {
				return fail("Unknown integration domain.");
			}
			const result = await disconnectIntegrationAction(
				locals,
				domain as IntegrationDomain,
				providerId,
			);
			if (!result.ok) {
				return fail(`integration disconnect failed: ${result.code}`);
			}
			return redirect(
				`/ap-admin/services?disconnected=${encodeURIComponent(domain)}:${encodeURIComponent(providerId)}`,
			);
		},
	);
