// ─── Admin Page Model Helpers ─────────────────────────────────────────────────
// Extracted from admin-page-models.ts to keep that file under the 400-line limit.

import type { AdminDashboardModel } from "./admin-dashboard";
import type { AuthUser } from "./platform-contracts";
import { isAuthUserAdmin } from "./platform-contracts";

type Status = "ok" | "partial" | "forbidden" | "not_found";

export type AdminPageResult<T> = {
	status: Status;
	data: T;
	warnings: string[];
};

export function result<T>(status: Status, data: T, warnings: string[] = []): AdminPageResult<T> {
	return { status, data, warnings };
}

export function ok<T>(data: T, warnings: string[] = []): AdminPageResult<T> {
	return result(warnings.length > 0 ? "partial" : "ok", data, warnings);
}

export function forbidden<T>(data: T): AdminPageResult<T> {
	return result("forbidden", data);
}

export function notFound<T>(data: T, warnings: string[] = []): AdminPageResult<T> {
	return result("not_found", data, warnings);
}

/**
 * Admin-only break-glass page guard. Returns `forbidden(empty)` when the
 * subject is not an admin (per `isAuthUserAdmin`); otherwise builds the
 * page model. Use this for pages whose entire surface is admin-only —
 * per-action authorization on individual operations should go through
 * `Astro.locals.access.can(...)`.
 */
export async function adminOnlyPage<T>(
	user: AuthUser | null | undefined,
	empty: T,
	build: (warnings: string[]) => Promise<T>,
): Promise<AdminPageResult<T>> {
	if (!user || !isAuthUserAdmin(user)) return forbidden(empty);
	const warnings: string[] = [];
	return ok(await build(warnings), warnings);
}

export async function withFallback<T>(
	warnings: string[],
	message: string,
	load: () => Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await load();
	} catch {
		warnings.push(message);
		return fallback;
	}
}

export async function withSettledMap<TInput, TOutput>(
	warnings: string[],
	message: string,
	items: TInput[],
	map: (item: TInput) => Promise<TOutput>,
	fallback: (item: TInput) => TOutput,
): Promise<TOutput[]> {
	const settled = await Promise.allSettled(items.map((item) => map(item)));
	const hadFailure = settled.some((entry) => entry.status === "rejected");
	if (hadFailure) {
		warnings.push(message);
	}

	return settled.map((entry, index) =>
		entry.status === "fulfilled" ? entry.value : fallback(items[index]),
	);
}

export function emptyDashboardModel(): AdminDashboardModel {
	return {
		auditEvents: [],
		comments: [],
		redirectRules: [],
		routePages: [],
		contentStates: [],
		systemRoutes: [],
		posts: [],
		pages: [],
		reviewPosts: [],
		scheduledPosts: [],
		recentAuditEvents: [],
		recentActivity: [],
		translationNeedsAttention: 0,
		seoNeedsAttention: 0,
		archiveRoutes: [],
		supportSurfaceLinks: [],
		latestDeployment: null,
	};
}
