import {
	inviteRuntimeAdminUser,
	sendUserInviteEmail,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import { resolveFlashStore } from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/users", requireAction: "users:invite" },
		async ({ actor, formData, locals, request, redirect, fail }) => {
			const result = await inviteRuntimeAdminUser(
				{
					name: String(formData.get("name") ?? ""),
					email: String(formData.get("email") ?? ""),
					role: String(formData.get("role") ?? ""),
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error);
			}

			const redirectUrl = new URL("/ap-admin/users", request.url);

			if (result.inviteUrl) {
				const absoluteInviteUrl = new URL(result.inviteUrl, request.url).toString();
				const emailResult = await sendUserInviteEmail(
					String(formData.get("email") ?? ""),
					absoluteInviteUrl,
					locals,
				);
				if (!emailResult.ok) {
					redirectUrl.searchParams.set("error", "1");
					redirectUrl.searchParams.set("message", emailResult.error ?? "Invitation email failed.");
					return redirect(redirectUrl.pathname + redirectUrl.search);
				}
				if (emailResult.delivered) {
					redirectUrl.searchParams.set("saved", "1");
				} else {
					// Email was not actually sent (preview/mock mode) — user was created
					// but no email went out. Hand the invite link to the page via the
					// one-time flash store keyed by an opaque id, never the URL (#133).
					redirectUrl.searchParams.set("user_created", "1");
					const flash = await resolveFlashStore(locals);
					if (!flash) return fail("Flash store is not available.");
					const { id } = await flash.put(result.inviteUrl);
					redirectUrl.searchParams.set("flash", id);
				}
			} else {
				redirectUrl.searchParams.set("saved", "1");
			}

			return redirect(redirectUrl.pathname + redirectUrl.search);
		},
	);
