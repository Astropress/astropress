import { withAdminFormAction } from "@astropress-diy/astropress";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import type { ApiScope } from "@astropress-diy/astropress/platform-contracts.js";
import type { APIRoute } from "astro";

const VALID_SCOPES: ApiScope[] = [
	"content:read",
	"content:write",
	"media:read",
	"media:write",
	"settings:read",
	"webhooks:manage",
];

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/api-tokens", requireAdmin: true },
		async ({ formData, redirect, fail }) => {
			const label = String(formData.get("label") ?? "").trim();
			if (!label) return fail("Token label is required.");

			const scopeValues = formData.getAll("scopes").map(String) as ApiScope[];
			const scopes = scopeValues.filter((s) => VALID_SCOPES.includes(s));
			if (scopes.length === 0) return fail("At least one scope is required.");

			const store = await loadLocalAdminStore();
			if (!store.apiTokens) return fail("API token store is not available.");

			const { record, rawToken } = await store.apiTokens.create({
				label,
				scopes,
			});
			// Pass the raw token once via redirect query param — page shows it once then it's gone
			return redirect(
				`/ap-admin/api-tokens?created=1&tokenId=${encodeURIComponent(record.id)}&rawToken=${encodeURIComponent(rawToken)}`,
			);
		},
	);
