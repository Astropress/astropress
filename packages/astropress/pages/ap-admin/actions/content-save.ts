import { saveRuntimeContentState } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { sanitizeHtml } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/posts" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const slug = String(formData.get("slug") ?? "");
			const result = await saveRuntimeContentState(
				slug,
				{
					title: String(formData.get("title") ?? ""),
					status: String(formData.get("status") ?? ""),
					scheduledAt: String(formData.get("scheduledAt") ?? ""),
					body: await sanitizeHtml(String(formData.get("body") ?? "")),
					authorIds: formData
						.getAll("authorIds")
						.map((value) => Number(value))
						.filter((value) => Number.isInteger(value) && value > 0),
					categoryIds: formData
						.getAll("categoryIds")
						.map((value) => Number(value))
						.filter((value) => Number.isInteger(value) && value > 0),
					tagIds: formData
						.getAll("tagIds")
						.map((value) => Number(value))
						.filter((value) => Number.isInteger(value) && value > 0),
					seoTitle: String(formData.get("seoTitle") ?? ""),
					metaDescription: String(formData.get("metaDescription") ?? ""),
					excerpt: String(formData.get("excerpt") ?? ""),
					ogTitle: String(formData.get("ogTitle") ?? ""),
					ogDescription: String(formData.get("ogDescription") ?? ""),
					ogImage: String(formData.get("ogImage") ?? ""),
					canonicalUrlOverride: String(
						formData.get("canonicalUrlOverride") ?? "",
					),
					robotsDirective: String(formData.get("robotsDirective") ?? ""),
					revisionNote: String(formData.get("revisionNote") ?? ""),
					lastKnownUpdatedAt:
						String(formData.get("lastKnownUpdatedAt") ?? "") || undefined,
				},
				actor,
				locals,
			);

			if (!result.ok) {
				if (result.conflict) {
					return new Response(
						JSON.stringify({ error: result.error, conflict: true }),
						{
							status: 409,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return fail(result.error, `/ap-admin/posts/${slug}`);
			}

			return redirect(`/ap-admin/posts/${slug}?saved=1`);
		},
	);
