import type { APIContext } from "astro";
import type {
	AuditEvent,
	CommentRecord,
	ContentRecord as PersistedContentRecord,
	RedirectRule,
} from "./persistence-types";
import type { SeededContentRecordLike } from "./seeded-content-type";

type TranslationEntry = {
	route: string;
	translationState: string;
};

type ContentRecord = PersistedContentRecord & SeededContentRecordLike;

type StructuredRoute = {
	path: string;
	title: string;
	updatedAt?: string;
	seoTitle?: string;
	metaDescription?: string;
	summary?: string;
};

type SystemRoute = {
	path: string;
	title: string;
	summary?: string;
};

type ArchiveRoute = { title?: string } | null;

type DashboardDeps = {
	getRuntimeAuditEvents: (
		locals: APIContext["locals"],
	) => Promise<AuditEvent[]>;
	getRuntimeComments: (
		locals: APIContext["locals"],
	) => Promise<CommentRecord[]>;
	getRuntimeRedirectRules: (
		locals: APIContext["locals"],
	) => Promise<RedirectRule[]>;
	getRuntimeTranslationState: (
		route: string,
		fallback: string,
		locals: APIContext["locals"],
	) => Promise<string>;
	listRuntimeContentStates: (
		locals: APIContext["locals"],
	) => Promise<ContentRecord[]>;
	listRuntimeStructuredPageRoutes: (
		locals: APIContext["locals"],
	) => Promise<StructuredRoute[]>;
	listRuntimeSystemRoutes: (
		locals: APIContext["locals"],
	) => Promise<SystemRoute[]>;
	getRuntimeArchiveRoute: (
		path: string,
		locals: APIContext["locals"],
	) => Promise<ArchiveRoute>;
	isSeededPostRecord: (record: ContentRecord) => boolean;
};

export type AdminDashboardModel = {
	auditEvents: AuditEvent[];
	comments: CommentRecord[];
	redirectRules: RedirectRule[];
	routePages: StructuredRoute[];
	contentStates: ContentRecord[];
	systemRoutes: SystemRoute[];
	posts: ContentRecord[];
	pages: ContentRecord[];
	reviewPosts: ContentRecord[];
	scheduledPosts: ContentRecord[];
	recentAuditEvents: AuditEvent[];
	recentActivity: Array<{
		title: string;
		updatedAt?: string;
		editHref: string;
		kind: string;
	}>;
	translationNeedsAttention: number;
	seoNeedsAttention: number;
	archiveRoutes: ArchiveRoute[];
	supportSurfaceLinks: Array<{
		label: string;
		href: string;
		count: number;
		helper: string;
	}>;
	latestDeployment: AuditEvent | null;
};

async function settledValue<T>(promise: Promise<T>, fallback: T) {
	try {
		return await promise;
	} catch {
		return fallback;
	}
}

export async function buildAdminDashboardModel(
	locals: APIContext["locals"],
	role: "admin" | "editor",
	translationStatus: TranslationEntry[],
	deps: DashboardDeps,
): Promise<AdminDashboardModel> {
	const [
		auditEvents,
		comments,
		redirectRules,
		routePages,
		contentStates,
		systemRoutes,
	] = await Promise.all([
		settledValue(deps.getRuntimeAuditEvents(locals), []),
		settledValue(deps.getRuntimeComments(locals), []),
		settledValue(deps.getRuntimeRedirectRules(locals), []),
		settledValue(deps.listRuntimeStructuredPageRoutes(locals), []),
		settledValue(deps.listRuntimeContentStates(locals), []),
		settledValue(deps.listRuntimeSystemRoutes(locals), []),
	]);

	const now = Date.now();
	const posts = contentStates.filter((record) =>
		deps.isSeededPostRecord(record),
	);
	const pages = contentStates.filter(
		(record) => !deps.isSeededPostRecord(record),
	);
	const reviewPosts = posts.filter(
		(record) =>
			(record.status ?? "published") === "review" ||
			(record.status ?? "published") === "draft",
	);
	const scheduledPosts = posts
		.filter(
			(record) =>
				record.scheduledAt &&
				Number.isFinite(Date.parse(record.scheduledAt)) &&
				Date.parse(record.scheduledAt) > now,
		)
		.sort(
			(left, right) =>
				Date.parse(left.scheduledAt ?? "") -
				Date.parse(right.scheduledAt ?? ""),
		)
		.slice(0, 5);
	const recentAuditEvents = auditEvents.slice(0, 6);
	const latestDeployment =
		auditEvents.find((event) => event.targetType === "deployment") ?? null;
	const recentActivity = (
		role === "admin"
			? [
					...contentStates.map((record) => ({
						title: record.title,
						updatedAt: record.updatedAt,
						editHref: `/ap-admin/posts/${record.slug}`,
						kind: deps.isSeededPostRecord(record) ? "Post" : "Page",
					})),
					...routePages.map((route) => ({
						title: route.title,
						updatedAt: route.updatedAt,
						editHref: `/ap-admin/route-pages${route.path}`,
						kind: "Structured Page",
					})),
				]
			: posts.map((record) => ({
					title: record.title,
					updatedAt: record.updatedAt,
					editHref: `/ap-admin/posts/${record.slug}`,
					kind: "Post",
				}))
	)
		.filter((record) => Boolean(record.updatedAt))
		.sort(
			(left, right) =>
				Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""),
		)
		.slice(0, 6);

	const translationEntries =
		role === "admin"
			? await settledValue(
					Promise.all(
						translationStatus.map(async (entry) => ({
							route: entry.route,
							state: await deps.getRuntimeTranslationState(
								entry.route,
								entry.translationState,
								locals,
							),
						})),
					),
					[] as Array<{ route: string; state: string }>,
				)
			: [];

	const translationNeedsAttention = translationEntries.filter(
		(entry) => entry.state !== "published",
	).length;
	const seoNeedsAttention = [
		...contentStates.filter(
			(record) => !record.seoTitle || !record.metaDescription,
		),
		...routePages.filter((route) => !route.seoTitle || !route.metaDescription),
	].length;

	const archiveRoutes: ArchiveRoute[] =
		role === "admin"
			? await settledValue(
					Promise.all([
						deps.getRuntimeArchiveRoute("/author", locals),
						deps.getRuntimeArchiveRoute("/category", locals),
						deps.getRuntimeArchiveRoute("/tag", locals),
					]),
					[null, null, null] as [ArchiveRoute, ArchiveRoute, ArchiveRoute],
				)
			: [];

	const supportSurfaceLinks = [
		{
			label: "Translations",
			href: "/ap-admin/translations",
			count: translationNeedsAttention,
			helper: "Localized routes not yet published.",
		},
		{
			label: "SEO",
			href: "/ap-admin/seo?missing=1",
			count: seoNeedsAttention,
			helper: "Pages or routes missing dedicated metadata.",
		},
		{
			label: "Archives",
			href: "/ap-admin/archives",
			count: archiveRoutes.filter(Boolean).length,
			helper: "Archive landing pages with separate owner editors.",
		},
		{
			label: "System",
			href: "/ap-admin/system",
			count: systemRoutes.length,
			helper: "500 page and generated public outputs.",
		},
	];

	return {
		auditEvents,
		comments,
		redirectRules,
		routePages,
		contentStates,
		systemRoutes,
		posts,
		pages,
		reviewPosts,
		scheduledPosts,
		recentAuditEvents,
		recentActivity,
		translationNeedsAttention,
		seoNeedsAttention,
		archiveRoutes,
		supportSurfaceLinks,
		latestDeployment,
	};
}
