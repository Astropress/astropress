import { withAdminFormAction } from "@astropress-diy/astropress";
import { createRuntimeStructuredPageRoute } from "@astropress-diy/astropress";
import { getCmsConfig } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

function buildDefaultSections(title: string, summary: string, path: string) {
	return {
		hero: {
			title,
			subtitle: "Astropress",
			body: summary,
			image: "/images/home/field-learning.jpg",
			imageAlt: title,
			cta: [
				{ label: "Learn more", href: path.startsWith("/es/") ? "/es" : "/en" },
			],
		},
		body: {
			heading: title,
			paragraphs: [summary || "Add page content here."],
			bullets: [],
		},
		cta: {
			title: "Stay Connected",
			body: "Link this page to the next action you want visitors to take.",
			buttons: [
				{
					label: "Donate",
					href: path.startsWith("/es/") ? "/es/dona" : "/donate",
				},
			],
		},
	};
}

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/pages/new", requireAdmin: true },
		async ({ actor, formData, locals, redirect, fail }) => {
			const path = String(formData.get("path") ?? "");
			const title = String(formData.get("title") ?? "");
			const summary = String(formData.get("summary") ?? "");
			const templateKeys = getCmsConfig().templateKeys;
			const templateKey = templateKeys.includes("landing")
				? "landing"
				: templateKeys.includes("content")
					? "content"
					: templateKeys[0];
			if (!templateKey) {
				return fail("No route-page template is registered for this project.");
			}
			const result = await createRuntimeStructuredPageRoute(
				path,
				{
					title,
					summary,
					seoTitle: String(formData.get("seoTitle") ?? ""),
					metaDescription: String(formData.get("metaDescription") ?? ""),
					templateKey,
					sections: buildDefaultSections(title, summary, path),
					revisionNote: "Created route page.",
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error);
			}

			return redirect(`/ap-admin/route-pages${result.route.path}?created=1`);
		},
	);
