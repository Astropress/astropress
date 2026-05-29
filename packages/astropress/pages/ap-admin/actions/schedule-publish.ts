import {
	getRuntimeContentState,
	scheduleRuntimePublish,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin", requireAction: "posts:publish" },
		async ({ formData, redirect, fail }) => {
			const slug = String(formData.get("slug") ?? "").trim();
			if (!slug) return fail("Content slug is required.");

			const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
			if (!scheduledAt) return fail("Scheduled date/time is required.");

			// Validate ISO date string
			const date = new Date(scheduledAt);
			if (Number.isNaN(date.getTime())) return fail("Invalid date/time format.");
			if (date <= new Date()) return fail("Scheduled date must be in the future.");

			const existing = await getRuntimeContentState(slug, context.locals);
			if (!existing) return fail("Content not found.");

			const result = await scheduleRuntimePublish(slug, date.toISOString(), context.locals);
			if (!result.ok) return fail(result.error);
			return redirect(`/ap-admin/posts/${slug}?scheduled=1`);
		},
	);
