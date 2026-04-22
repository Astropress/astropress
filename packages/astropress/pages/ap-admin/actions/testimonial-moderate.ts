import { moderateRuntimeTestimonial } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import type { TestimonialStatus } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/testimonials" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const id = String(formData.get("testimonialId") ?? "");
			const statusValue = String(
				formData.get("status") ?? "",
			) as TestimonialStatus;
			if (!["approved", "rejected", "featured"].includes(statusValue)) {
				return fail("Invalid status.");
			}

			const result = await moderateRuntimeTestimonial(
				id,
				statusValue,
				actor,
				locals,
			);
			if (!result.ok) {
				return fail(result.error);
			}

			return redirect("/ap-admin/testimonials?saved=1");
		},
	);
