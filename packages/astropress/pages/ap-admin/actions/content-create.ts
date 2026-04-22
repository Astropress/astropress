import { createRuntimeContentRecord } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/posts/new" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const result = await createRuntimeContentRecord(
				{
					title: String(formData.get("title") ?? ""),
					slug: String(formData.get("slug") ?? ""),
					legacyUrl: String(formData.get("legacyUrl") ?? ""),
					status: String(formData.get("status") ?? "draft"),
					body: String(formData.get("body") ?? ""),
					summary: String(formData.get("summary") ?? ""),
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
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error);
			}

			const slug =
				typeof result.state === "object" &&
				result.state &&
				"slug" in result.state
					? String(result.state.slug)
					: "";
			return redirect(`/ap-admin/posts/${slug}?created=1`);
		},
	);
