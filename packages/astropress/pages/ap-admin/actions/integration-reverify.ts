import {
	reverifyIntegrationAction,
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
			const fields: Record<string, string> = {};
			for (const [key, value] of formData.entries()) {
				if (
					key === "domain" ||
					key === "providerId" ||
					key === "_csrf" ||
					typeof value !== "string"
				) {
					continue;
				}
				fields[key] = value;
			}
			const result = await reverifyIntegrationAction(
				locals,
				domain as IntegrationDomain,
				providerId,
				fields,
			);
			if (!result.ok) {
				return fail(`integration reverify failed: ${result.code}`);
			}
			return redirect(
				`/ap-admin/services?reverified=${encodeURIComponent(domain)}:${encodeURIComponent(providerId)}`,
			);
		},
	);
