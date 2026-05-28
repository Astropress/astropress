import {
	getCmsConfig,
	saveRuntimeStructuredPageRoute,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import { parseSectionsFromJson, sanitizeSections } from "@astropress-diy/astropress/sections";
import type { APIRoute } from "astro";

function parseJson<T>(value: FormDataEntryValue | null, fallback: T) {
	try {
		return JSON.parse(String(value ?? "")) as T;
	} catch {
		return fallback;
	}
}

function parseTemplateKey(value: FormDataEntryValue | null): string | null {
	const normalized = String(value ?? "").trim();
	if (getCmsConfig().templateKeys.includes(normalized)) {
		return normalized;
	}
	return null;
}

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/route-pages", requireAction: "routePages:edit" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const templateKey = parseTemplateKey(formData.get("templateKey"));
			if (!templateKey) {
				return fail("Invalid template key");
			}

			const path = String(formData.get("path") ?? "").trim();

			const sectionsRaw = String(formData.get("sectionsJson") ?? "");
			const parsedSections = parseSectionsFromJson(sectionsRaw);
			if (!parsedSections.ok) {
				const first = parsedSections.errors[0];
				return fail(
					`Invalid sections payload at ${first.path}: ${first.message}`,
					`/ap-admin/route-pages${path}`,
				);
			}
			const safeSections = await sanitizeSections(parsedSections.sections);

			const result = await saveRuntimeStructuredPageRoute(
				path,
				{
					title: String(formData.get("title") ?? "").trim(),
					summary: String(formData.get("summary") ?? "").trim(),
					seoTitle: String(formData.get("seoTitle") ?? "").trim(),
					metaDescription: String(formData.get("metaDescription") ?? "").trim(),
					canonicalUrlOverride: String(formData.get("canonicalUrlOverride") ?? "").trim(),
					robotsDirective: String(formData.get("robotsDirective") ?? "").trim(),
					ogImage: String(formData.get("ogImage") ?? "").trim(),
					templateKey,
					alternateLinks: parseJson<Array<{ hreflang: string; href: string }>>(
						formData.get("alternateLinksJson"),
						[],
					),
					sections: { sections: safeSections } as unknown as Record<string, unknown>,
					revisionNote: String(formData.get("revisionNote") ?? "").trim(),
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error, `/ap-admin/route-pages${path}`);
			}

			return redirect(`/ap-admin/route-pages${path}?saved=1`);
		},
	);
