export function createAstropressCmsRouteRegistry(input) {
  return {
    listSystemRoutes: (...args) => input.listSystemRoutes(...args),
    getSystemRoute(pathname) {
      return input.getSystemRoute(input.normalizePath(pathname));
    },
    saveSystemRoute(pathname, rawInput, actor) {
      const normalizedPath = input.normalizePath(pathname);
      if (!normalizedPath) {
        return { ok: false, error: "A system route path is required." };
      }
      const route = input.findSystemRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false, error: "The selected system route could not be found." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false, error: "A title is required." };
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
        ok: true,
        route: {
          path: normalizedPath,
          title,
          summary: summary ?? undefined,
          bodyHtml: bodyHtml ?? undefined,
          settings,
          renderStrategy: route.renderStrategy,
        },
      };
    },
    listStructuredPageRoutes: (...args) => input.listStructuredPageRoutes(...args),
    getStructuredPageRoute(pathname) {
      return input.getStructuredPageRoute(input.normalizePath(pathname));
    },
    createStructuredPageRoute(pathname, rawInput, actor) {
      const normalizedPath = input.normalizePath(pathname);
      if (!normalizedPath || normalizedPath === "/") {
        return { ok: false, error: "A public path is required." };
      }
      if (input.isRoutePathTaken(normalizedPath)) {
        return { ok: false, error: "That public path is already in use." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false, error: "A title is required." };
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
        return { ok: false, error: "The route page could not be created." };
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
      return { ok: true, route: created };
    },
    saveStructuredPageRoute(pathname, rawInput, actor) {
      const normalizedPath = input.normalizePath(pathname);
      const route = input.findStructuredRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false, error: "The selected route page could not be found." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false, error: "A title is required." };
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
      return { ok: true, route: input.getStructuredPageRoute(normalizedPath) };
    },
    getArchiveRoute(pathname) {
      return input.getArchiveRoute(input.normalizePath(pathname));
    },
    listArchiveRoutes: (...args) => input.listArchiveRoutes(...args),
    saveArchiveRoute(pathname, rawInput, actor) {
      const normalizedPath = input.normalizePath(pathname);
      const route = input.findArchiveRouteForUpdate(normalizedPath);
      if (!route) {
        return { ok: false, error: "The selected archive route could not be found." };
      }
      const title = rawInput.title.trim();
      if (!title) {
        return { ok: false, error: "A title is required." };
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
      return { ok: true, route: input.getArchiveRoute(normalizedPath) };
    },
  };
}
