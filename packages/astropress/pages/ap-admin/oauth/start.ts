import {
	buildAuthorizeRedirect,
	getAstropressRootSecretCandidates,
	getOAuthProvider,
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
			const returnTo =
				String(formData.get("returnTo") ?? "/ap-admin/services").trim() ||
				"/ap-admin/services";
			if (!domain || !providerId) {
				return fail("Missing domain or providerId.");
			}
			if (!ALLOWED_DOMAINS.has(domain as IntegrationDomain)) {
				return fail("Unknown integration domain.");
			}
			const provider = getOAuthProvider(
				domain as IntegrationDomain,
				providerId,
			);
			if (!provider) {
				return fail("Unknown OAuth provider for this domain.");
			}
			const env =
				(locals as { runtime?: { env?: Record<string, string> } } | null)
					?.runtime?.env ?? (typeof process !== "undefined" ? process.env : {});
			const clientId = env[provider.clientIdEnv];
			if (!clientId) {
				return fail(
					`OAuth provider is not configured (env ${provider.clientIdEnv} is missing).`,
				);
			}
			const rootSecret = getAstropressRootSecretCandidates(locals)[0];
			if (!rootSecret) {
				return fail("Root secret is unavailable.");
			}
			const url = new URL(context.request.url);
			const { redirectUrl } = await buildAuthorizeRedirect({
				provider,
				origin: url.origin,
				clientId,
				returnTo,
				rootSecret,
				nowMs: Date.now(),
			});
			return redirect(redirectUrl);
		},
	);
