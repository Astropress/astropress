import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin" }, async ({ formData, redirect, fail }) => {
    const slug = String(formData.get("slug") ?? "").trim();
    if (!slug) return fail("Content slug is required.");

    const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
    if (!scheduledAt) return fail("Scheduled date/time is required.");

    // Validate ISO date string
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) return fail("Invalid date/time format.");
    if (date <= new Date()) return fail("Scheduled date must be in the future.");

    const store = await loadLocalAdminStore();
    if (!store.schedulePublish) return fail("Content scheduling is not available.");

    const existing = await store.getContentState(slug);
    if (!existing) return fail("Content not found.");

    store.schedulePublish(slug, date.toISOString());
    return redirect(`/ap-admin/posts/${slug}?scheduled=1`);
  });
