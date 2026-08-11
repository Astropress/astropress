import { getRuntimeMediaAssets, getRuntimeTestimonials } from "./runtime-page-store";
import {
	getRuntimeStructuredPageRoute,
	listRuntimeStructuredPageRoutes,
} from "./runtime-route-registry";
// Import the section helpers from their concrete modules rather than the
// `./sections` barrel: the dist build appends `.js` to extensionless relative
// imports, which turns a bare `./sections` directory import into a non-existent
// `./sections.js`. The barrel is only safe to import via the package's scoped
// subpath (used by the .astro entrypoints), not by a sibling src module.
import { renderSectionsBody } from "./sections/preview-renderer";
import { buildSectionRenderContext } from "./sections/render-prep";
import { parseSections } from "./sections/schema";

/**
 * The resolved, render-ready view of a published structured page. `body` is the
 * already-rendered sections HTML; the remaining fields feed the document
 * `<head>`. `buildPublicStructuredPageModel` returns `null` (not a partial
 * model) for any path that must not render publicly, so callers issue a 404.
 */
export interface PublicStructuredPageModel {
	title: string;
	description: string;
	canonical: string;
	robots: string;
	ogImage: string;
	body: string;
}

/**
 * Resolve a public structured page by path: read its route record, enforce the
 * published-status gate, resolve exactly the media + testimonials its sections
 * reference (see `buildSectionRenderContext`), and render the body. Returns
 * `null` when the path has no published page.
 *
 * Shared by both public-renderer entrypoints — the prerendered production page
 * (`astropress-public-page.astro`) and the on-demand dev page
 * (`astropress-public-page-dev.astro`) — so the two can never drift in how a
 * page is resolved, gated, or rendered. See #198 for why dev needs a separate
 * on-demand entrypoint.
 */
export async function buildPublicStructuredPageModel(
	path: string,
	locals: App.Locals,
): Promise<PublicStructuredPageModel | null> {
	const record = await getRuntimeStructuredPageRoute(path, locals);
	// Only published pages are public. Drafts/review/archived → null → 404.
	if (record?.status !== "published") return null;

	const parsed = parseSections(record.sections);
	const sections = parsed.ok ? parsed.sections : [];
	// Resolve the media URLs and testimonials the sections reference — only
	// approved/featured testimonials are ever fetched for the public surface, and
	// buildSectionRenderContext additionally gates on consentToPublish.
	const context = await buildSectionRenderContext(
		sections,
		{
			listMediaAssets: () => getRuntimeMediaAssets(locals),
			listPublicTestimonials: async () => [
				...(await getRuntimeTestimonials("approved", locals)),
				...(await getRuntimeTestimonials("featured", locals)),
			],
		},
		locals,
	);
	// lang/dir aren't wired yet: renderSectionsBody defaults the document to
	// dir="ltr" (and <html lang="en"> is fixed) because neither
	// StructuredPageRouteRecord nor SiteSettings carries a locale. Tracked with
	// the public-site RTL work in #72.
	const body = renderSectionsBody(sections, context);

	// `path` is always the leading-slash form (`/${slug}`); drop the slash for the
	// title fallback. (slice over /^\//-replace so the mutant is observable.)
	const slug = path.slice(1);
	return {
		title: record.seoTitle || record.title || slug,
		description: record.metaDescription ?? record.summary ?? "",
		canonical: record.canonicalUrlOverride ?? "",
		robots: record.robotsDirective ?? "",
		ogImage: record.ogImage ?? "",
		body,
	};
}

/**
 * The published-page path set for the production build's `getStaticPaths()`.
 * Kept beside `buildPublicStructuredPageModel` so the "which pages are public"
 * rule lives in one place instead of being duplicated in the `.astro`
 * entrypoint. The site root (`/`) is owned by the host's own `index.astro`, so
 * an admin-authored page at `/` is intentionally excluded from the catch-all.
 */
export async function listPublishedStructuredPagePaths(): Promise<string[]> {
	const pages = await listRuntimeStructuredPageRoutes();
	return pages
		.filter((page) => page.status === "published")
		.map((page) => page.path)
		.filter((path): path is string => Boolean(path) && path !== "/");
}
