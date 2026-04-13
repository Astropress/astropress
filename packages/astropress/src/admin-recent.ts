import type { APIContext } from "astro";
import { listRuntimeContentStates } from "./runtime-page-store";
import { listRuntimeStructuredPageRoutes } from "./runtime-route-registry-pages";
import { isSeededPostRecord } from "./seeded-content-type";

export type RecentAdminItem = {
  title: string;
  updatedAt?: string;
  editHref: string;
  kind: string;
};

/**
 * Returns the 5 most recently updated content items for the sidebar "Recent" section.
 * Lightweight alternative to `buildAdminDashboardModel` — avoids loading audit events,
 * comments, redirects, etc. that the sidebar does not need.
 */
export async function getRecentAdminItems(
  locals: APIContext["locals"],
  role: "admin" | "editor",
): Promise<RecentAdminItem[]> {
  try {
    const [contentStates, routePages] = await Promise.all([
      listRuntimeContentStates(locals).catch(() => []),
      role === "admin"
        ? listRuntimeStructuredPageRoutes(locals).catch(() => [])
        : Promise.resolve([]),
    ]);

    const items: RecentAdminItem[] = role === "admin"
      ? [
          ...contentStates.map((record) => ({
            title: record.title,
            updatedAt: record.updatedAt,
            editHref: `/ap-admin/posts/${record.slug}`,
            kind: isSeededPostRecord(record) ? "Post" : "Page",
          })),
          ...routePages.map((route) => ({
            title: route.title,
            updatedAt: route.updatedAt,
            editHref: `/ap-admin/route-pages${route.path}`,
            kind: "Structured Page",
          })),
        ]
      : contentStates.map((record) => ({
          title: record.title,
          updatedAt: record.updatedAt,
          editHref: `/ap-admin/posts/${record.slug}`,
          kind: "Post",
        }));

    return items
      .filter((item) => Boolean(item.updatedAt))
      .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
      .slice(0, 5);
  } catch {
    return [];
  }
}
