import type { Actor } from "./persistence-types";
import type {
  RuntimeArchiveRouteRecord,
  RuntimeStructuredPageRouteRecord,
  RuntimeSystemRouteRecord,
} from "./runtime-route-registry";

interface RouteActor extends Actor {}

export interface AstropressCmsRouteRegistryFactoryInput {
  normalizePath(pathname: string): string;
  localeFromPath(pathname: string): string;
  listSystemRoutes(): RuntimeSystemRouteRecord[];
  getSystemRoute(pathname: string): RuntimeSystemRouteRecord | null;
  listStructuredPageRoutes(): RuntimeStructuredPageRouteRecord[];
  getStructuredPageRoute(pathname: string): RuntimeStructuredPageRouteRecord | null;
  getArchiveRoute(pathname: string): RuntimeArchiveRouteRecord | null;
  listArchiveRoutes(): RuntimeArchiveRouteRecord[];
  findSystemRouteForUpdate(pathname: string): { id: string; renderStrategy: RuntimeSystemRouteRecord["renderStrategy"] } | null | undefined;
  persistSystemRoute(input: {
    routeId: string;
    title: string;
    summary: string | null;
    bodyHtml: string | null;
    settingsJson: string | null;
    actor: RouteActor;
  }): void;
  appendSystemRouteRevision(input: {
    routeId: string;
    pathname: string;
    locale: string;
    title: string;
    summary: string | null;
    bodyHtml: string | null;
    settings: Record<string, unknown> | null | undefined;
    renderStrategy: RuntimeSystemRouteRecord["renderStrategy"];
    revisionNote: string | null;
    actor: RouteActor;
  }): void;
  isRoutePathTaken(pathname: string): boolean;
  findStructuredRouteForUpdate(pathname: string): { id: string } | null | undefined;
  insertStructuredRoute(input: {
    pathname: string;
    locale: string;
    title: string;
    summary: string | null;
    seoTitle: string;
    metaDescription: string;
    canonicalUrlOverride: string | null;
    robotsDirective: string | null;
    ogImage: string | null;
    templateKey: string;
    alternateLinks: Array<{ hreflang: string; href: string }>;
    sections: Record<string, unknown> | null | undefined;
    actor: RouteActor;
  }): void;
  persistStructuredRoute(input: {
    routeId: string;
    pathname: string;
    title: string;
    summary: string | null;
    seoTitle: string;
    metaDescription: string;
    canonicalUrlOverride: string | null;
    robotsDirective: string | null;
    ogImage: string | null;
    templateKey: string;
    alternateLinks: Array<{ hreflang: string; href: string }>;
    sections: Record<string, unknown> | null | undefined;
    actor: RouteActor;
  }): void;
  appendStructuredRouteRevision(input: {
    routeId: string;
    pathname: string;
    locale: string;
    title: string;
    summary: string | null;
    seoTitle: string;
    metaDescription: string;
    canonicalUrlOverride: string | null;
    robotsDirective: string | null;
    ogImage: string | null;
    templateKey: string;
    alternateLinks: Array<{ hreflang: string; href: string }>;
    sections: Record<string, unknown> | null | undefined;
    revisionNote: string | null;
    actor: RouteActor;
  }): void;
  findArchiveRouteForUpdate(pathname: string): { id: string } | null | undefined;
  persistArchiveRoute(input: {
    routeId: string;
    pathname: string;
    title: string;
    summary: string | null;
    seoTitle: string;
    metaDescription: string;
    canonicalUrlOverride: string | null;
    robotsDirective: string | null;
    actor: RouteActor;
  }): void;
  appendArchiveRouteRevision(input: {
    routeId: string;
    pathname: string;
    title: string;
    summary: string | null;
    seoTitle: string;
    metaDescription: string;
    canonicalUrlOverride: string | null;
    robotsDirective: string | null;
    revisionNote: string | null;
    actor: RouteActor;
  }): void;
  recordRouteAudit(input: {
    actor: RouteActor;
    action: "system.update" | "route_page.create" | "route_page.update" | "archive.update";
    summary: string;
    targetId: string;
  }): void;
}

export function createAstropressCmsRouteRegistry(
  input: AstropressCmsRouteRegistryFactoryInput,
) {
  return {
    listSystemRoutes: (...args: []) => input.listSystemRoutes(...args),
    getSystemRoute(pathname: string) {
      return input.getSystemRoute(input.normalizePath(pathname));
    },
    saveSystemRoute(
      pathname: string,
      rawInput: {
        title: string;
        summary?: string;
        bodyHtml?: string;
        settings?: Record<string, unknown> | null;
        revisionNote?: string;
      },
      actor: RouteActor,
    ) {
      const normalizedPath = input.normalizePath(pathname);
      if (!normalizedPath) {
        return { ok: false as const, error: "A system route path is required." };
      }

      const route = input.findSystemRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false as const, error: "The selected system route could not be found." };
      }

      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false as const, error: "A title is required." };
      }

      const summary = rawInput.summary?.trim() || null;
      const bodyHtml = rawInput.bodyHtml?.trim() || null;
      const settings = rawInput.settings ?? null;
      input.persistSystemRoute({
        routeId: route.id,
        title,
        summary,
        bodyHtml,
        settingsJson: settings ? JSON.stringify(settings) : null,
        actor,
      });
      input.appendSystemRouteRevision({
        routeId: route.id,
        pathname: normalizedPath,
        locale: input.localeFromPath(normalizedPath),
        title,
        summary,
        bodyHtml,
        settings,
        renderStrategy: route.renderStrategy,
        revisionNote: rawInput.revisionNote?.trim() || null,
        actor,
      });
      input.recordRouteAudit({
        actor,
        action: "system.update",
        summary: `Updated system route ${normalizedPath}.`,
        targetId: normalizedPath,
      });
      return {
        ok: true as const,
        route: {
          path: normalizedPath,
          title,
          summary: summary ?? undefined,
          bodyHtml: bodyHtml ?? undefined,
          settings,
          renderStrategy: route.renderStrategy,
        } satisfies RuntimeSystemRouteRecord,
      };
    },
    listStructuredPageRoutes: (...args: []) => input.listStructuredPageRoutes(...args),
    getStructuredPageRoute(pathname: string) {
      return input.getStructuredPageRoute(input.normalizePath(pathname));
    },
    createStructuredPageRoute(
      pathname: string,
      rawInput: {
        title: string;
        summary?: string;
        seoTitle?: string;
        metaDescription?: string;
        canonicalUrlOverride?: string;
        robotsDirective?: string;
        ogImage?: string;
        templateKey: string;
        alternateLinks?: Array<{ hreflang: string; href: string }>;
        sections?: Record<string, unknown> | null;
        revisionNote?: string;
      },
      actor: RouteActor,
    ) {
      const normalizedPath = input.normalizePath(pathname);
      if (!normalizedPath || normalizedPath === "/") {
        return { ok: false as const, error: "A public path is required." };
      }
      if (input.isRoutePathTaken(normalizedPath)) {
        return { ok: false as const, error: "That public path is already in use." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false as const, error: "A title is required." };
      }
      const summary = rawInput.summary?.trim() || null;
      const seoTitle = rawInput.seoTitle?.trim() || title;
      const metaDescription = rawInput.metaDescription?.trim() || summary || title;
      const canonicalUrlOverride = rawInput.canonicalUrlOverride?.trim() || null;
      const robotsDirective = rawInput.robotsDirective?.trim() || null;
      const ogImage = rawInput.ogImage?.trim() || null;
      const alternateLinks = rawInput.alternateLinks ?? [];
      const sections = rawInput.sections ?? null;
      const locale = input.localeFromPath(normalizedPath);

      input.insertStructuredRoute({
        pathname: normalizedPath,
        locale,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: rawInput.templateKey,
        alternateLinks,
        sections,
        actor,
      });
      const created = input.getStructuredPageRoute(normalizedPath);
      const routeId = input.findStructuredRouteForUpdate(normalizedPath);
      if (!created || !routeId) {
        return { ok: false as const, error: "The route page could not be created." };
      }
      input.appendStructuredRouteRevision({
        routeId: routeId.id,
        pathname: normalizedPath,
        locale,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: rawInput.templateKey,
        alternateLinks,
        sections,
        revisionNote: rawInput.revisionNote?.trim() || "Created route page.",
        actor,
      });
      input.recordRouteAudit({
        actor,
        action: "route_page.create",
        summary: `Created route page ${normalizedPath}.`,
        targetId: normalizedPath,
      });
      return { ok: true as const, route: created };
    },
    saveStructuredPageRoute(
      pathname: string,
      rawInput: {
        title: string;
        summary?: string;
        seoTitle?: string;
        metaDescription?: string;
        canonicalUrlOverride?: string;
        robotsDirective?: string;
        ogImage?: string;
        templateKey: string;
        alternateLinks?: Array<{ hreflang: string; href: string }>;
        sections?: Record<string, unknown> | null;
        revisionNote?: string;
      },
      actor: RouteActor,
    ) {
      const normalizedPath = input.normalizePath(pathname);
      const route = input.findStructuredRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false as const, error: "The selected route page could not be found." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false as const, error: "A title is required." };
      }
      const summary = rawInput.summary?.trim() || null;
      const seoTitle = rawInput.seoTitle?.trim() || title;
      const metaDescription = rawInput.metaDescription?.trim() || summary || title;
      const canonicalUrlOverride = rawInput.canonicalUrlOverride?.trim() || null;
      const robotsDirective = rawInput.robotsDirective?.trim() || null;
      const ogImage = rawInput.ogImage?.trim() || null;
      const alternateLinks = rawInput.alternateLinks ?? [];
      const sections = rawInput.sections ?? null;
      input.persistStructuredRoute({
        routeId: route.id,
        pathname: normalizedPath,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: rawInput.templateKey,
        alternateLinks,
        sections,
        actor,
      });
      input.appendStructuredRouteRevision({
        routeId: route.id,
        pathname: normalizedPath,
        locale: input.localeFromPath(normalizedPath),
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: rawInput.templateKey,
        alternateLinks,
        sections,
        revisionNote: rawInput.revisionNote?.trim() || null,
        actor,
      });
      input.recordRouteAudit({
        actor,
        action: "route_page.update",
        summary: `Updated route page ${normalizedPath}.`,
        targetId: normalizedPath,
      });
      return {
        ok: true as const,
        route: input.getStructuredPageRoute(normalizedPath)!,
      };
    },
    getArchiveRoute(pathname: string) {
      return input.getArchiveRoute(input.normalizePath(pathname));
    },
    listArchiveRoutes: (...args: []) => input.listArchiveRoutes(...args),
    saveArchiveRoute(
      pathname: string,
      rawInput: {
        title: string;
        summary?: string;
        seoTitle?: string;
        metaDescription?: string;
        canonicalUrlOverride?: string;
        robotsDirective?: string;
        revisionNote?: string;
      },
      actor: RouteActor,
    ) {
      const normalizedPath = input.normalizePath(pathname);
      const route = input.findArchiveRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false as const, error: "The selected archive route could not be found." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false as const, error: "A title is required." };
      }
      const summary = rawInput.summary?.trim() || null;
      const seoTitle = rawInput.seoTitle?.trim() || title;
      const metaDescription = rawInput.metaDescription?.trim() || summary || "";
      const canonicalUrlOverride = rawInput.canonicalUrlOverride?.trim() || null;
      const robotsDirective = rawInput.robotsDirective?.trim() || null;
      input.persistArchiveRoute({
        routeId: route.id,
        pathname: normalizedPath,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        actor,
      });
      input.appendArchiveRouteRevision({
        routeId: route.id,
        pathname: normalizedPath,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        revisionNote: rawInput.revisionNote?.trim() || null,
        actor,
      });
      input.recordRouteAudit({
        actor,
        action: "archive.update",
        summary: `Updated archive route ${normalizedPath}.`,
        targetId: normalizedPath,
      });
      return {
        ok: true as const,
        route: input.getArchiveRoute(normalizedPath)!,
      };
    },
  };
}
