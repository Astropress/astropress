import {
	createRuntimePasswordResetToken,
	sendPasswordResetEmail,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import { resolveFlashStore } from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/users", requireAdmin: true },
		async ({ actor, formData, locals, request, redirect, fail }) => {
			const email = String(formData.get("email") ?? "");
			const result = await createRuntimePasswordResetToken(email, actor, locals);

			if (!result.ok) {
				return fail(result.error);
			}

			const redirectUrl = new URL("/ap-admin/users", request.url);
			const absoluteResetUrl = result.resetUrl
				? new URL(result.resetUrl, request.url).toString()
				: null;
			if (result.resetUrl && absoluteResetUrl) {
				const emailResult = await sendPasswordResetEmail(email, absoluteResetUrl, locals);
				if (!emailResult.ok) {
					return fail(emailResult.error ?? "Password reset email failed.");
				}
			}
			if (result.resetUrl) {
				// Deliver the reset link via the one-time flash store (#133) rather
				// than the URL — the page consumes it server-side exactly once.
				const flash = await resolveFlashStore(locals);
				if (!flash) return fail("Flash store is not available.");
				const { id } = await flash.put(result.resetUrl);
				redirectUrl.searchParams.set("reset_flash", id);
			}
			return redirect(redirectUrl.pathname + redirectUrl.search);
		},
	);
