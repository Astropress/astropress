import { withAdminFormAction } from "@astropress-diy/astropress";
import {
	resolveApiRuntime,
	resolveFlashStore,
} from "@astropress-diy/astropress/admin-store-dispatch.js";
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
		{ failurePath: "/ap-admin/api-tokens", requireAction: "apiTokens:create" },
		async ({ formData, redirect, fail }) => {
			const label = String(formData.get("label") ?? "").trim();
			if (!label) return fail("Token label is required.");

			const scopeValues = formData.getAll("scopes").map(String) as ApiScope[];
			const scopes = scopeValues.filter((s) => VALID_SCOPES.includes(s));
			if (scopes.length === 0) return fail("At least one scope is required.");

			const { apiTokens } = await resolveApiRuntime(context.locals);
			if (!apiTokens) return fail("API token store is not available.");

			const { record, rawToken } = await apiTokens.create({
				label,
				scopes,
			});
			// Hand the raw token to the page via a one-time server-side flash store
			// keyed by an opaque id — never put the secret in the URL (#113).
			const flash = await resolveFlashStore(context.locals);
			if (!flash) return fail("Flash store is not available.");
			const { id } = await flash.put(rawToken);
			return redirect(
				`/ap-admin/api-tokens?created=1&tokenId=${encodeURIComponent(record.id)}&flash=${encodeURIComponent(id)}`,
			);
		},
	);
