// packages/astropress/src/sqlite-admin-runtime.ts
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// packages/astropress/src/config.ts
var CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
function getConfigStore() {
  return globalThis;
}
function getCmsConfig() {
  const config = getConfigStore()[CMS_CONFIG_KEY] ?? null;
  if (!config) {
    throw new Error("CMS not initialized — call registerCms() before using the CMS.");
  }
  return config;
}

// packages/astropress/src/admin-store-adapter-factory.ts
function createAstropressAdminStoreAdapter(backend, modules) {
  return {
    backend,
    ...modules
  };
}

// packages/astropress/src/auth-repository-factory.ts
function mapSessionUser(row) {
  return {
    email: row.email,
    role: row.role,
    name: row.name
  };
}
function isUsableToken(expiresAt, consumedAt, active, now) {
  return !consumedAt && active && Date.parse(expiresAt) >= now;
}
function createAstropressAuthRepository(input) {
  return {
    async authenticatePersistedAdminUser(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return null;
      }
      const user = input.findActiveAdminUserByEmail(normalizedEmail);
      if (!user || !input.verifyPassword(password, user.passwordHash)) {
        return null;
      }
      return mapSessionUser(user);
    },
    createSession(user, metadata) {
      const userId = input.findActiveAdminUserIdByEmail(user.email.toLowerCase());
      if (!userId) {
        throw new Error(`Cannot create a session for unknown admin user ${user.email}.`);
      }
      const sessionToken = input.randomId();
      const csrfToken = input.randomId();
      input.insertSession({
        sessionToken,
        userId,
        csrfToken,
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null
      });
      return sessionToken;
    },
    getSessionUser(sessionToken) {
      if (!sessionToken) {
        return null;
      }
      input.cleanupExpiredSessions();
      const row = input.findLiveSessionById(sessionToken);
      if (!row) {
        return null;
      }
      const lastActiveAt = Date.parse(row.lastActiveAt);
      if (!Number.isFinite(lastActiveAt) || input.now() - lastActiveAt > input.sessionTtlMs) {
        input.revokeSessionById(sessionToken);
        return null;
      }
      input.touchSession(sessionToken);
      return mapSessionUser(row);
    },
    getCsrfToken(sessionToken) {
      if (!sessionToken) {
        return null;
      }
      input.cleanupExpiredSessions();
      const row = input.findLiveSessionById(sessionToken);
      if (!row) {
        return null;
      }
      const lastActiveAt = Date.parse(row.lastActiveAt);
      if (!Number.isFinite(lastActiveAt) || input.now() - lastActiveAt > input.sessionTtlMs) {
        input.revokeSessionById(sessionToken);
        return null;
      }
      input.touchSession(sessionToken);
      return row.csrfToken;
    },
    revokeSession(sessionToken) {
      if (!sessionToken) {
        return;
      }
      input.revokeSessionById(sessionToken);
    },
    createPasswordResetToken(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }
      const user = input.findPasswordResetUserByEmail(normalizedEmail);
      if (!user) {
        return actor ? { ok: false, error: "That admin user could not be found." } : { ok: true, resetUrl: null };
      }
      input.consumePasswordResetTokensForUser(user.id);
      const rawToken = input.randomId();
      const tokenId = `reset-${input.randomId()}`;
      const expiresAt = new Date(input.now() + 60 * 60 * 1000).toISOString();
      input.insertPasswordResetToken({
        tokenId,
        userId: user.id,
        tokenHash: input.hashOpaqueToken(rawToken),
        expiresAt,
        requestedBy: actor?.email ?? null
      });
      if (actor) {
        input.recordAuthAudit({
          actor,
          action: "auth.password_reset_issue",
          summary: `Issued a password reset link for ${normalizedEmail}.`,
          targetId: normalizedEmail
        });
      }
      return { ok: true, resetUrl: `/wp-admin/reset-password?token=${encodeURIComponent(rawToken)}` };
    },
    getInviteRequest(rawToken) {
      const trimmedToken = rawToken.trim();
      if (!trimmedToken) {
        return null;
      }
      const row = input.findInviteTokenByHash(input.hashOpaqueToken(trimmedToken));
      if (!row || !isUsableToken(row.expiresAt, row.acceptedAt, row.active, input.now())) {
        return null;
      }
      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expiresAt
      };
    },
    getPasswordResetRequest(rawToken) {
      const trimmedToken = rawToken.trim();
      if (!trimmedToken) {
        return null;
      }
      const row = input.findPasswordResetTokenByHash(input.hashOpaqueToken(trimmedToken));
      if (!row || !isUsableToken(row.expiresAt, row.consumedAt, row.active, input.now())) {
        return null;
      }
      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expiresAt
      };
    },
    consumeInviteToken(rawToken, password) {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 12) {
        return { ok: false, error: "Password must be at least 12 characters." };
      }
      const request = this.getInviteRequest(rawToken);
      if (!request) {
        return { ok: false, error: "That invitation link is invalid or has expired." };
      }
      const row = input.findInviteTokenByHash(input.hashOpaqueToken(rawToken.trim()));
      if (!row || !isUsableToken(row.expiresAt, row.acceptedAt, row.active, input.now())) {
        return { ok: false, error: "That invitation link is invalid or has expired." };
      }
      input.updateAdminUserPassword(row.userId, input.hashPassword(trimmedPassword));
      input.acceptInvitesForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.invite_accept",
        summary: `${row.email} accepted an admin invitation.`,
        targetId: row.email
      });
      return {
        ok: true,
        user: {
          email: row.email,
          role: row.role,
          name: row.name
        }
      };
    },
    consumePasswordResetToken(rawToken, password) {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 12) {
        return { ok: false, error: "Password must be at least 12 characters." };
      }
      const request = this.getPasswordResetRequest(rawToken);
      if (!request) {
        return { ok: false, error: "That password reset link is invalid or has expired." };
      }
      const row = input.findPasswordResetTokenByHash(input.hashOpaqueToken(rawToken.trim()));
      if (!row || !isUsableToken(row.expiresAt, row.consumedAt, row.active, input.now())) {
        return { ok: false, error: "That password reset link is invalid or has expired." };
      }
      input.updateAdminUserPassword(row.userId, input.hashPassword(trimmedPassword));
      input.markPasswordResetTokenConsumed(row.id);
      input.revokeSessionsForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.password_reset_complete",
        summary: `${row.email} completed a password reset.`,
        targetId: row.email
      });
      return {
        ok: true,
        user: {
          email: row.email,
          role: row.role,
          name: row.name
        }
      };
    },
    recordSuccessfulLogin(actor) {
      input.recordAuthAudit({
        actor,
        action: "auth.login",
        summary: `${actor.name} signed in successfully.`,
        targetId: actor.email
      });
    },
    recordLogout(actor) {
      input.recordAuthAudit({
        actor,
        action: "auth.logout",
        summary: `${actor.name} signed out.`,
        targetId: actor.email
      });
    }
  };
}

// packages/astropress/src/host-runtime-factories.ts
function createAstropressCmsRegistryModule(registry) {
  return {
    listSystemRoutes: (...args) => registry.listSystemRoutes(...args),
    getSystemRoute: (...args) => registry.getSystemRoute(...args),
    saveSystemRoute: (...args) => registry.saveSystemRoute(...args),
    listStructuredPageRoutes: (...args) => registry.listStructuredPageRoutes(...args),
    getStructuredPageRoute: (...args) => registry.getStructuredPageRoute(...args),
    saveStructuredPageRoute: (...args) => registry.saveStructuredPageRoute(...args),
    createStructuredPageRoute: (...args) => registry.createStructuredPageRoute(...args),
    getArchiveRoute: (...args) => registry.getArchiveRoute(...args),
    listArchiveRoutes: (...args) => registry.listArchiveRoutes(...args),
    saveArchiveRoute: (...args) => registry.saveArchiveRoute(...args)
  };
}

// packages/astropress/src/cms-route-registry-factory.ts
function createAstropressCmsRouteRegistry(input) {
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
        actor
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
        actor
      });
      input.recordRouteAudit({
        actor,
        action: "system.update",
        summary: `Updated system route ${normalizedPath}.`,
        targetId: normalizedPath
      });
      return {
        ok: true,
        route: {
          path: normalizedPath,
          title,
          summary: summary ?? undefined,
          bodyHtml: bodyHtml ?? undefined,
          settings,
          renderStrategy: route.renderStrategy
        }
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
        actor
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
        actor
      });
      input.recordRouteAudit({
        actor,
        action: "route_page.create",
        summary: `Created route page ${normalizedPath}.`,
        targetId: normalizedPath
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
        actor
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
        actor
      });
      input.recordRouteAudit({
        actor,
        action: "route_page.update",
        summary: `Updated route page ${normalizedPath}.`,
        targetId: normalizedPath
      });
      return {
        ok: true,
        route: input.getStructuredPageRoute(normalizedPath)
      };
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
        actor
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
        actor
      });
      input.recordRouteAudit({
        actor,
        action: "archive.update",
        summary: `Updated archive route ${normalizedPath}.`,
        targetId: normalizedPath
      });
      return {
        ok: true,
        route: input.getArchiveRoute(normalizedPath)
      };
    }
  };
}

// packages/astropress/src/content-repository-factory.ts
function normalizeAssignments(values) {
  return [...new Set((values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];
}
function mapContentState(record, override, assignments) {
  return {
    ...record,
    title: override?.title ?? record.title,
    status: override?.status ?? record.status,
    scheduledAt: override?.scheduledAt,
    body: override?.body ?? record.body,
    authorIds: assignments.authorIds,
    categoryIds: assignments.categoryIds,
    tagIds: assignments.tagIds,
    seoTitle: override?.seoTitle ?? record.seoTitle,
    metaDescription: override?.metaDescription ?? record.metaDescription,
    excerpt: override?.excerpt ?? record.excerpt,
    ogTitle: override?.ogTitle,
    ogDescription: override?.ogDescription,
    ogImage: override?.ogImage,
    canonicalUrlOverride: override?.canonicalUrlOverride,
    robotsDirective: override?.robotsDirective
  };
}
function createAstropressContentRepository(input) {
  function getContentState(slug) {
    const record = input.findContentRecord(slug);
    if (!record) {
      return null;
    }
    return mapContentState(record, input.getPersistedOverride(record.slug), input.getContentAssignments(record.slug));
  }
  return {
    listContentStates() {
      return input.listContentRecords().map((record) => getContentState(record.slug)).filter((record) => Boolean(record)).sort((left, right) => Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""));
    },
    getContentState,
    getContentRevisions(slug) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return null;
      }
      input.ensureBaselineRevision(record);
      return input.listPersistedRevisions(record.slug);
    },
    restoreRevision(slug, revisionId, actor) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return { ok: false, error: "The selected content record could not be found." };
      }
      input.ensureBaselineRevision(record);
      const revision = input.getPersistedRevision(record.slug, revisionId);
      if (!revision) {
        return { ok: false, error: "Revision not found." };
      }
      input.upsertContentOverride(record.slug, {
        title: revision.title,
        status: revision.status,
        scheduledAt: revision.scheduledAt,
        body: revision.body,
        seoTitle: revision.seoTitle,
        metaDescription: revision.metaDescription,
        excerpt: revision.excerpt,
        ogTitle: revision.ogTitle,
        ogDescription: revision.ogDescription,
        ogImage: revision.ogImage,
        canonicalUrlOverride: revision.canonicalUrlOverride,
        robotsDirective: revision.robotsDirective
      }, actor);
      input.replaceContentAssignments(record.slug, {
        authorIds: revision.authorIds ?? [],
        categoryIds: revision.categoryIds ?? [],
        tagIds: revision.tagIds ?? []
      });
      input.insertReviewedRevision(record.slug, {
        title: revision.title,
        status: revision.status,
        scheduledAt: revision.scheduledAt,
        body: revision.body,
        seoTitle: revision.seoTitle,
        metaDescription: revision.metaDescription,
        excerpt: revision.excerpt,
        ogTitle: revision.ogTitle,
        ogDescription: revision.ogDescription,
        ogImage: revision.ogImage,
        authorIds: revision.authorIds,
        categoryIds: revision.categoryIds,
        tagIds: revision.tagIds,
        canonicalUrlOverride: revision.canonicalUrlOverride,
        robotsDirective: revision.robotsDirective,
        revisionNote: revision.revisionNote
      }, actor);
      input.recordContentAudit({
        actor,
        action: "content.restore",
        summary: `Restored revision ${revisionId} for ${slug}.`,
        targetId: record.slug
      });
      return { ok: true };
    },
    saveContentState(slug, rawInput, actor) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return { ok: false, error: "The selected content record could not be found." };
      }
      const title = rawInput.title.trim();
      const seoTitle = rawInput.seoTitle.trim();
      const metaDescription = rawInput.metaDescription.trim();
      const status = input.normalizeContentStatus(rawInput.status);
      const body = rawInput.body?.trim() || record.body || "";
      const scheduledAt = rawInput.scheduledAt?.trim() ? new Date(rawInput.scheduledAt).toISOString() : undefined;
      const revisionNote = rawInput.revisionNote?.trim() || undefined;
      if (!title || !seoTitle || !metaDescription) {
        return { ok: false, error: "Title, SEO title, and meta description are required." };
      }
      input.ensureBaselineRevision(record);
      const assignments = {
        authorIds: normalizeAssignments(rawInput.authorIds),
        categoryIds: normalizeAssignments(rawInput.categoryIds),
        tagIds: normalizeAssignments(rawInput.tagIds)
      };
      input.upsertContentOverride(record.slug, {
        title,
        status,
        scheduledAt,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined
      }, actor);
      input.replaceContentAssignments(record.slug, assignments);
      input.insertReviewedRevision(record.slug, {
        title,
        status,
        scheduledAt,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        authorIds: assignments.authorIds,
        categoryIds: assignments.categoryIds,
        tagIds: assignments.tagIds,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
        revisionNote
      }, actor);
      input.recordContentAudit({
        actor,
        action: "content.update",
        summary: `Updated reviewed metadata for ${record.legacyUrl}.`,
        targetId: record.slug
      });
      return { ok: true, state: getContentState(record.slug) };
    },
    createContentRecord(rawInput, actor) {
      const title = rawInput.title.trim();
      const slug = input.slugifyTerm(rawInput.slug);
      const legacyUrl = input.normalizePath(rawInput.legacyUrl?.trim() || `/${slug}`);
      const seoTitle = rawInput.seoTitle.trim() || title;
      const metaDescription = rawInput.metaDescription.trim();
      const status = input.normalizeContentStatus(rawInput.status);
      const body = rawInput.body?.trim() || "";
      const summary = rawInput.summary?.trim() || "";
      if (!title || !slug || !metaDescription) {
        return { ok: false, error: "Title, slug, and meta description are required." };
      }
      if (input.findContentRecord(slug) || input.findContentRecord(legacyUrl.replace(/^\//, ""))) {
        return { ok: false, error: "That slug is already in use." };
      }
      const inserted = input.insertContentEntry({
        slug,
        legacyUrl,
        title,
        body,
        summary,
        seoTitle,
        metaDescription,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined
      });
      if (!inserted) {
        return { ok: false, error: "That slug or route is already in use." };
      }
      input.upsertContentOverride(slug, {
        title,
        status,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || summary || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined
      }, actor);
      input.insertReviewedRevision(slug, {
        title,
        status,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || summary || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
        revisionNote: "Created new post."
      }, actor);
      input.recordContentAudit({
        actor,
        action: "content.create",
        summary: `Created post ${legacyUrl}.`,
        targetId: slug
      });
      return { ok: true, state: getContentState(slug) };
    }
  };
}

// packages/astropress/src/local-media-storage.ts
import { unlinkSync, writeFileSync } from "node:fs";
import path2 from "node:path";

// packages/astropress/src/local-image-storage.ts
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
var workspaceRoot = process.cwd();
var defaultImageRoot = path.resolve(workspaceRoot, "..", "new-site-images");
function getLocalImageRoot() {
  return process.env.LOCAL_IMAGE_ROOT?.trim() || defaultImageRoot;
}
function getLocalUploadsDir() {
  return path.join(getLocalImageRoot(), "uploads");
}
function ensureLocalUploadsDir() {
  mkdirSync(getLocalUploadsDir(), { recursive: true });
}
function guessImageMimeType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".svg"))
    return "image/svg+xml";
  if (lower.endsWith(".png"))
    return "image/png";
  if (lower.endsWith(".webp"))
    return "image/webp";
  if (lower.endsWith(".gif"))
    return "image/gif";
  if (lower.endsWith(".avif"))
    return "image/avif";
  return "image/jpeg";
}

// packages/astropress/src/local-media-storage.ts
var uploadsDir = getLocalUploadsDir();
var allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml"
]);
var allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);
var maxUploadBytes = 10 * 1024 * 1024;
function guessMediaMimeType(pathname) {
  return guessImageMimeType(pathname);
}
function buildLocalMediaDescriptor(input) {
  if (!input.filename || input.bytes.byteLength === 0) {
    return { ok: false, error: "Select a file to upload." };
  }
  if (input.bytes.byteLength > maxUploadBytes) {
    return { ok: false, error: "File exceeds the 10 MB size limit." };
  }
  const extension = path2.extname(input.filename).toLowerCase() || ".bin";
  if (!allowedExtensions.has(extension)) {
    return { ok: false, error: "File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images." };
  }
  const guessedMime = input.mimeType || guessMediaMimeType(`file${extension}`);
  if (!allowedMimeTypes.has(guessedMime)) {
    return { ok: false, error: "File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images." };
  }
  ensureLocalUploadsDir();
  const baseName = path2.basename(input.filename, extension).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "upload";
  const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedFilename = `${baseName}-${id}${extension}`;
  const diskPath = path2.join(uploadsDir, storedFilename);
  const publicPath = `/images/uploads/${storedFilename}`;
  return {
    ok: true,
    asset: {
      id,
      storedFilename,
      diskPath,
      publicPath,
      r2Key: `uploads/${storedFilename}`,
      mimeType: input.mimeType || guessMediaMimeType(storedFilename),
      fileSize: input.bytes.byteLength,
      title: input.title?.trim() || baseName,
      altText: input.altText?.trim() ?? ""
    }
  };
}
function createLocalMediaUpload(input) {
  const descriptor = buildLocalMediaDescriptor(input);
  if (!descriptor.ok) {
    return descriptor;
  }
  ensureLocalUploadsDir();
  writeFileSync(descriptor.asset.diskPath, Buffer.from(input.bytes));
  return descriptor;
}
function deleteLocalMediaUpload(localPath) {
  if (!localPath.startsWith("/images/uploads/")) {
    return;
  }
  const diskPath = path2.join(uploadsDir, path2.basename(localPath));
  try {
    unlinkSync(diskPath);
  } catch {}
}

// packages/astropress/src/local-media-repository-factory.ts
function createAstropressLocalMediaRepository(options) {
  return {
    listMediaAssets: (...args) => options.listMediaAssets(...args),
    updateMediaAsset: (...args) => options.updateMediaAsset(...args),
    createMediaAsset(input, actor) {
      const stored = createLocalMediaUpload(input);
      if (!stored.ok) {
        return stored;
      }
      options.insertStoredMediaAsset({ asset: stored.asset, actor });
      options.recordMediaAudit({
        actor,
        action: "media.upload",
        summary: `Uploaded media asset ${stored.asset.storedFilename}.`,
        targetId: stored.asset.id
      });
      return { ok: true, id: stored.asset.id };
    },
    deleteMediaAsset(id, actor) {
      const assetId = id.trim();
      if (!assetId) {
        return { ok: false, error: "Media asset id is required." };
      }
      const row = options.getStoredMediaDeletionCandidate(assetId);
      if (!row) {
        return { ok: false, error: "The selected media asset could not be deleted." };
      }
      const deleted = options.markStoredMediaDeleted(assetId);
      if (!deleted) {
        return { ok: false, error: "The selected media asset could not be deleted." };
      }
      deleteLocalMediaUpload(row.localPath);
      options.recordMediaAudit({
        actor,
        action: "media.delete",
        summary: `Deleted media asset ${assetId}.`,
        targetId: assetId
      });
      return { ok: true };
    }
  };
}

// packages/astropress/src/redirect-repository-factory.ts
function createAstropressRedirectRepository(input) {
  return {
    getRedirectRules: (...args) => input.getRedirectRules(...args),
    createRedirectRule(rawInput, actor) {
      const sourcePath = input.normalizePath(rawInput.sourcePath);
      const targetPath = input.normalizePath(rawInput.targetPath);
      const statusCode = rawInput.statusCode === 302 ? 302 : 301;
      if (!sourcePath || !targetPath) {
        return { ok: false, error: "Both legacy and target paths are required." };
      }
      if (sourcePath === targetPath) {
        return { ok: false, error: "Legacy and target paths must be different." };
      }
      const existing = input.getExistingRedirect(sourcePath);
      if (existing && existing.deletedAt === null) {
        return { ok: false, error: "That legacy path already has a reviewed redirect rule." };
      }
      input.upsertRedirect({
        sourcePath,
        targetPath,
        statusCode,
        actor
      });
      input.recordRedirectAudit({
        actor,
        action: "redirect.create",
        summary: `Created redirect ${sourcePath} -> ${targetPath} (${statusCode}).`,
        targetId: sourcePath
      });
      return { ok: true, rule: { sourcePath, targetPath, statusCode } };
    },
    deleteRedirectRule(sourcePath, actor) {
      const normalizedSourcePath = input.normalizePath(sourcePath);
      const deleted = input.markRedirectDeleted(normalizedSourcePath);
      if (!deleted) {
        return { ok: false };
      }
      input.recordRedirectAudit({
        actor,
        action: "redirect.delete",
        summary: `Deleted redirect ${normalizedSourcePath}.`,
        targetId: normalizedSourcePath
      });
      return { ok: true };
    }
  };
}

// packages/astropress/src/taxonomy-repository-factory.ts
function createTerm(input, table, kind, rawInput, actor) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!name || !slug) {
    return { ok: false, error: `${kind} name and slug are required.` };
  }
  const created = input.createTaxonomyTerm({
    table,
    slug,
    name,
    description: rawInput.description?.trim() ?? ""
  });
  if (!created) {
    return { ok: false, error: `That ${kind} name or slug is already in use.` };
  }
  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.create`,
    summary: `Created ${kind} ${name}.`,
    targetId: slug
  });
  return { ok: true };
}
function updateTerm(input, table, kind, rawInput, actor) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!rawInput.id || !name || !slug) {
    return { ok: false, error: `${kind} id, name, and slug are required.` };
  }
  const updated = input.updateTaxonomyTerm({
    table,
    id: rawInput.id,
    slug,
    name,
    description: rawInput.description?.trim() ?? ""
  });
  if (!updated) {
    return { ok: false, error: `That ${kind} could not be updated.` };
  }
  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.update`,
    summary: `Updated ${kind} ${name}.`,
    targetId: String(rawInput.id)
  });
  return { ok: true };
}
function deleteTerm(input, table, kind, id, actor) {
  const deleted = input.deleteTaxonomyTerm({ table, id });
  if (!deleted) {
    return { ok: false, error: `That ${kind} could not be deleted.` };
  }
  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.delete`,
    summary: `Deleted ${kind} ${id}.`,
    targetId: String(id)
  });
  return { ok: true };
}
function createAstropressTaxonomyRepository(input) {
  return {
    listCategories: (...args) => input.listCategories(...args),
    listTags: (...args) => input.listTags(...args),
    createCategory: (rawInput, actor) => createTerm(input, "categories", "category", rawInput, actor),
    updateCategory: (rawInput, actor) => updateTerm(input, "categories", "category", rawInput, actor),
    deleteCategory: (id, actor) => deleteTerm(input, "categories", "category", id, actor),
    createTag: (rawInput, actor) => createTerm(input, "tags", "tag", rawInput, actor),
    updateTag: (rawInput, actor) => updateTerm(input, "tags", "tag", rawInput, actor),
    deleteTag: (id, actor) => deleteTerm(input, "tags", "tag", id, actor)
  };
}

// packages/astropress/src/author-repository-factory.ts
function createAstropressAuthorRepository(input) {
  return {
    listAuthors: (...args) => input.listAuthors(...args),
    createAuthor(rawInput, actor) {
      const name = rawInput.name.trim();
      const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
      if (!name || !slug) {
        return { ok: false, error: "Author name and slug are required." };
      }
      const created = input.createAuthor({
        slug,
        name,
        bio: rawInput.bio?.trim() ?? ""
      });
      if (!created) {
        return { ok: false, error: "That author name or slug is already in use." };
      }
      input.recordAuthorAudit({
        actor,
        action: "author.create",
        summary: `Created author ${name}.`,
        targetId: slug
      });
      return { ok: true };
    },
    updateAuthor(rawInput, actor) {
      const name = rawInput.name.trim();
      const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
      if (!rawInput.id || !name || !slug) {
        return { ok: false, error: "Author id, name, and slug are required." };
      }
      const updated = input.updateAuthor({
        id: rawInput.id,
        slug,
        name,
        bio: rawInput.bio?.trim() ?? ""
      });
      if (!updated) {
        return { ok: false, error: "That author could not be updated." };
      }
      input.recordAuthorAudit({
        actor,
        action: "author.update",
        summary: `Updated author ${name}.`,
        targetId: String(rawInput.id)
      });
      return { ok: true };
    },
    deleteAuthor(id, actor) {
      const deleted = input.deleteAuthor(id);
      if (!deleted) {
        return { ok: false, error: "That author could not be deleted." };
      }
      input.recordAuthorAudit({
        actor,
        action: "author.delete",
        summary: `Deleted author ${id}.`,
        targetId: String(id)
      });
      return { ok: true };
    }
  };
}

// packages/astropress/src/comment-repository-factory.ts
function createAstropressCommentRepository(input) {
  return {
    getComments: (...args) => input.getComments(...args),
    moderateComment(commentId, nextStatus, actor) {
      const route = input.getCommentRoute(commentId);
      if (!route) {
        return { ok: false, error: "The selected comment record could not be found." };
      }
      input.updateCommentStatus(commentId, nextStatus);
      input.recordCommentAudit({
        actor,
        action: "comment.moderate",
        summary: `Marked ${route} as ${nextStatus}.`,
        targetId: commentId
      });
      return { ok: true };
    },
    submitPublicComment(rawInput) {
      const comment = {
        id: `public-${crypto.randomUUID()}`,
        author: rawInput.author,
        email: rawInput.email,
        body: rawInput.body,
        route: rawInput.route,
        status: "pending",
        policy: "open-moderated",
        submittedAt: rawInput.submittedAt
      };
      const submittedAt = input.insertPublicComment(comment);
      return { ok: true, comment: { ...comment, submittedAt } };
    },
    getApprovedCommentsForRoute(route) {
      return input.getComments().filter((comment) => comment.route === route && comment.status === "approved");
    }
  };
}

// packages/astropress/src/submission-repository-factory.ts
function createAstropressSubmissionRepository(input) {
  return {
    getContactSubmissions: (...args) => input.getContactSubmissions(...args),
    submitContact(rawInput) {
      const submission = {
        id: `contact-${crypto.randomUUID()}`,
        name: rawInput.name,
        email: rawInput.email,
        message: rawInput.message,
        submittedAt: rawInput.submittedAt
      };
      input.insertContactSubmission(submission);
      return { ok: true, submission };
    }
  };
}

// packages/astropress/src/user-repository-factory.ts
function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function createAstropressUserRepository(input) {
  return {
    listAdminUsers: (...args) => input.listAdminUsers(...args),
    inviteAdminUser(rawInput, actor) {
      const name = rawInput.name.trim();
      const email = rawInput.email.trim().toLowerCase();
      const role = rawInput.role === "admin" ? "admin" : rawInput.role === "editor" ? "editor" : "";
      if (!name || !email || !role) {
        return { ok: false, error: "Name, email, and role are required." };
      }
      if (!isValidEmailAddress(email)) {
        return { ok: false, error: "Enter a valid email address." };
      }
      const existing = input.findAdminUserByEmail(email);
      if (existing) {
        return { ok: false, error: "That email address already belongs to an admin user." };
      }
      const created = input.createInvitedAdminUser({
        email,
        passwordHash: input.hashPassword(crypto.randomUUID()),
        role,
        name
      });
      if (!created) {
        return { ok: false, error: "The invited user could not be created." };
      }
      const userId = input.getAdminUserIdByEmail(email);
      if (!userId) {
        return { ok: false, error: "The invited user could not be created." };
      }
      const rawToken = crypto.randomUUID();
      const inviteId = `invite-${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertedInvite = input.insertUserInvite({
        inviteId,
        userId,
        tokenHash: input.hashOpaqueToken(rawToken),
        expiresAt,
        invitedBy: actor.email
      });
      if (!insertedInvite) {
        return { ok: false, error: "The invitation link could not be created." };
      }
      input.recordUserAudit({
        actor,
        action: "user.invite",
        summary: `Invited ${email} as an ${role} user.`,
        targetId: email
      });
      return { ok: true, inviteUrl: `/wp-admin/accept-invite?token=${encodeURIComponent(rawToken)}` };
    },
    suspendAdminUser(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }
      if (normalizedEmail === actor.email.toLowerCase()) {
        return { ok: false, error: "You cannot suspend the account you are currently using." };
      }
      const suspended = input.setAdminUserActiveState(normalizedEmail, false);
      if (!suspended) {
        return { ok: false, error: "That admin user could not be suspended." };
      }
      input.revokeAdminSessionsForEmail(normalizedEmail);
      input.recordUserAudit({
        actor,
        action: "user.suspend",
        summary: `Suspended ${normalizedEmail}.`,
        targetId: normalizedEmail
      });
      return { ok: true };
    },
    unsuspendAdminUser(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }
      const restored = input.setAdminUserActiveState(normalizedEmail, true);
      if (!restored) {
        return { ok: false, error: "That admin user could not be restored." };
      }
      input.recordUserAudit({
        actor,
        action: "user.restore",
        summary: `Restored ${normalizedEmail}.`,
        targetId: normalizedEmail
      });
      return { ok: true };
    }
  };
}

// packages/astropress/src/site-settings.ts
var defaultSiteSettings = {
  siteTitle: "",
  siteTagline: "",
  donationUrl: "",
  newsletterEnabled: false,
  commentsDefaultPolicy: "legacy-readonly",
  adminSlug: "wp-admin"
};

// packages/astropress/src/settings-repository-factory.ts
function createAstropressSettingsRepository(input) {
  return {
    getSettings: (...args) => input.getSettings(...args),
    saveSettings(partial, actor) {
      const current = input.getSettings() ?? defaultSiteSettings;
      const updated = {
        siteTitle: partial.siteTitle ?? current.siteTitle,
        siteTagline: partial.siteTagline ?? current.siteTagline,
        donationUrl: partial.donationUrl ?? current.donationUrl,
        newsletterEnabled: partial.newsletterEnabled ?? current.newsletterEnabled,
        commentsDefaultPolicy: partial.commentsDefaultPolicy ?? current.commentsDefaultPolicy,
        adminSlug: partial.adminSlug ?? current.adminSlug
      };
      input.persistSettings(updated, actor);
      input.recordSettingsAudit(actor);
      return { ok: true, settings: updated };
    }
  };
}

// packages/astropress/src/translation-state.ts
var translationStates = [
  "not_started",
  "partial",
  "fallback_en",
  "translated",
  "reviewed",
  "published"
];
var legacyStateMap = {
  original: "not_started",
  "in-progress": "partial",
  "pending-review": "translated",
  approved: "reviewed",
  "needs-revision": "partial",
  archived: "fallback_en",
  complete: "published"
};
function normalizeTranslationState(value, fallback = "not_started") {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (translationStates.includes(normalized)) {
    return normalized;
  }
  return legacyStateMap[normalized] ?? fallback;
}

// packages/astropress/src/translation-repository-factory.ts
function createAstropressTranslationRepository(input) {
  return {
    updateTranslationState(route, state, actor) {
      const normalizedState = normalizeTranslationState(state, "__invalid__");
      if (!translationStates.includes(normalizedState)) {
        return { ok: false, error: `Invalid translation state. Must be one of: ${translationStates.join(", ")}` };
      }
      input.persistTranslationState(route, normalizedState, actor);
      input.recordTranslationAudit({
        actor,
        route,
        state: normalizedState
      });
      return { ok: true };
    },
    getEffectiveTranslationState(route, fallback = "not_started") {
      return normalizeTranslationState(input.readTranslationState(route), normalizeTranslationState(fallback));
    }
  };
}

// packages/astropress/src/rate-limit-repository-factory.ts
function createAstropressRateLimitRepository(input) {
  return {
    checkRateLimit(key, max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);
      if (!row || now - row.windowStartMs > windowMs) {
        input.resetRateLimitWindow(key, now, windowMs);
        return true;
      }
      if (row.count < max) {
        input.incrementRateLimitWindow(key);
        return true;
      }
      return false;
    },
    peekRateLimit(key, max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);
      if (!row || now - row.windowStartMs > windowMs) {
        return true;
      }
      return row.count < max;
    },
    recordFailedAttempt(key, _max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);
      if (!row || now - row.windowStartMs > windowMs) {
        input.resetRateLimitWindow(key, now, windowMs);
        return;
      }
      input.incrementRateLimitWindow(key);
    }
  };
}

// packages/astropress/src/sqlite-admin-runtime.ts
var DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
function normalizeStructuredTemplateKey(value) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    return getCmsConfig().templateKeys.includes(value) ? value : null;
  } catch {
    return null;
  }
}
function localeFromPath(pathname) {
  return pathname.startsWith("/es/") ? "es" : "en";
}
function getSeedPageRecords() {
  try {
    return getCmsConfig().seedPages;
  } catch {
    return [];
  }
}
function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function hashPasswordSync(password, iterations = 1e5) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}
function verifyPasswordSync(password, storedHash) {
  const [iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsText, 10);
  if (!iterations || !saltText || !hashText) {
    return false;
  }
  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
function normalizePath(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function slugifyTerm(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeContentStatus(input) {
  if (input === "draft" || input === "review" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}
function parseIdList(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}
function serializeIdList(values) {
  return JSON.stringify((values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b));
}
function parseSystemSettings(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function normalizeSystemRoutePath(pathname) {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function createAstropressSqliteAdminRuntime(options) {
  const getDb = options.getDatabase;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  function cleanupExpiredSessions() {
    getDb().prepare(`
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE revoked_at IS NULL
            AND last_active_at < datetime('now', '-12 hours')
        `).run();
  }
  function getCustomContentEntries() {
    return getDb().prepare(`
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `).all();
  }
  function mapCustomContentEntry(row) {
    return {
      slug: row.slug,
      legacyUrl: row.legacy_url,
      title: row.title,
      templateKey: row.template_key,
      listingItems: [],
      paginationLinks: [],
      sourceHtmlPath: row.source_html_path,
      updatedAt: row.updated_at,
      body: row.body ?? "",
      summary: row.summary ?? "",
      seoTitle: row.seo_title ?? row.title,
      metaDescription: row.meta_description ?? row.summary ?? "",
      ogTitle: row.og_title ?? undefined,
      ogDescription: row.og_description ?? undefined,
      ogImage: row.og_image ?? undefined,
      kind: row.kind,
      status: "draft"
    };
  }
  function getAllContentRecords() {
    return [...getSeedPageRecords(), ...getCustomContentEntries().map((row) => mapCustomContentEntry(row))];
  }
  function toContentRecord(pageRecord) {
    return {
      ...pageRecord,
      status: pageRecord.status ?? "published",
      seoTitle: pageRecord.seoTitle ?? pageRecord.title,
      metaDescription: pageRecord.metaDescription ?? pageRecord.summary ?? ""
    };
  }
  function findPageRecord(slug) {
    return getAllContentRecords().find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
  }
  function getContentAssignmentIds(slug) {
    const db = getDb();
    const authorIds = db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").all(slug).map((row) => row.author_id);
    const categoryIds = db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").all(slug).map((row) => row.category_id);
    const tagIds = db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").all(slug).map((row) => row.tag_id);
    return { authorIds, categoryIds, tagIds };
  }
  function replaceContentAssignments(slug, input) {
    const db = getDb();
    db.prepare("DELETE FROM content_authors WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_categories WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_tags WHERE slug = ?").run(slug);
    for (const authorId of input.authorIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)").run(slug, authorId);
    }
    for (const categoryId of input.categoryIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)").run(slug, categoryId);
    }
    for (const tagId of input.tagIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)").run(slug, tagId);
    }
  }
  function mapPersistedOverride(row) {
    if (!row) {
      return null;
    }
    return {
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at ?? undefined,
      body: row.body ?? undefined,
      seoTitle: row.seo_title,
      metaDescription: row.meta_description,
      excerpt: row.excerpt ?? undefined,
      ogTitle: row.og_title ?? undefined,
      ogDescription: row.og_description ?? undefined,
      ogImage: row.og_image ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined
    };
  }
  function getPersistedContentOverride(slug) {
    const row = getDb().prepare(`
          SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 scheduled_at, canonical_url_override, robots_directive
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `).get(slug);
    return mapPersistedOverride(row);
  }
  function ensureBaselineRevision(pageRecord) {
    const db = getDb();
    db.prepare(`
        INSERT INTO content_overrides (
          slug, title, status, body, seo_title, meta_description, excerpt, og_title,
          og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(slug) DO NOTHING
      `).run(pageRecord.slug, pageRecord.title, pageRecord.status ?? "published", pageRecord.body ?? null, pageRecord.seoTitle ?? pageRecord.title, pageRecord.metaDescription ?? pageRecord.summary ?? "", pageRecord.summary ?? null, null, null, null, null, null, null, "seed-import");
    const existing = db.prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1").get(pageRecord.slug);
    if (existing) {
      return;
    }
    db.prepare(`
        INSERT INTO content_revisions (
          id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)
      `).run(`revision-${randomId()}`, pageRecord.slug, pageRecord.title, pageRecord.status ?? "published", null, pageRecord.body ?? null, pageRecord.seoTitle ?? pageRecord.title, pageRecord.metaDescription ?? pageRecord.summary ?? "", pageRecord.summary ?? null, null, null, null, null, null, null, "imported-baseline", "seed-import");
  }
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }
  function getPersistedAuditEvents() {
    const rows = getDb().prepare(`
          SELECT id, user_email, action, resource_type, resource_id, summary, created_at
          FROM audit_events
          ORDER BY datetime(created_at) DESC, id DESC
        `).all();
    return rows.map((row) => ({
      id: `sqlite-audit-${row.id}`,
      action: row.action,
      actorEmail: row.user_email,
      actorRole: "admin",
      summary: row.summary,
      targetType: row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content" ? row.resource_type : "auth",
      targetId: row.resource_id ?? `${row.id}`,
      createdAt: row.created_at
    }));
  }
  function listAdminUsers() {
    const rows = getDb().prepare(`
          SELECT
            id,
            email,
            role,
            name,
            active,
            created_at,
            EXISTS (
              SELECT 1
              FROM user_invites i
              WHERE i.user_id = admin_users.id
                AND i.accepted_at IS NULL
                AND datetime(i.expires_at) > CURRENT_TIMESTAMP
            ) AS has_pending_invite
          FROM admin_users
          ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
      active: row.active === 1,
      status: row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active",
      createdAt: row.created_at
    }));
  }
  const sqliteUserRepository = createAstropressUserRepository({
    listAdminUsers,
    hashPassword: hashPasswordSync,
    hashOpaqueToken,
    findAdminUserByEmail(email) {
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) ?? null;
    },
    createInvitedAdminUser({ email, passwordHash, role, name }) {
      try {
        getDb().prepare(`
              INSERT INTO admin_users (email, password_hash, role, name, active)
              VALUES (?, ?, ?, ?, 1)
            `).run(email, passwordHash, role, name);
        return true;
      } catch {
        return false;
      }
    },
    getAdminUserIdByEmail(email) {
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email)?.id ?? null;
    },
    insertUserInvite({ inviteId, userId, tokenHash, expiresAt, invitedBy }) {
      try {
        getDb().prepare(`
              INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
              VALUES (?, ?, ?, ?, ?)
            `).run(inviteId, userId, tokenHash, expiresAt, invitedBy);
        return true;
      } catch {
        return false;
      }
    },
    setAdminUserActiveState(email, nextActive) {
      const expectedActive = nextActive ? 0 : 1;
      return getDb().prepare("UPDATE admin_users SET active = ? WHERE email = ? AND active = ?").run(nextActive ? 1 : 0, email, expectedActive).changes > 0;
    },
    revokeAdminSessionsForEmail(email) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = (SELECT id FROM admin_users WHERE email = ?)
              AND revoked_at IS NULL
          `).run(email);
    },
    recordUserAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
    }
  });
  const sqliteAuthRepository = createAstropressAuthRepository({
    sessionTtlMs,
    now,
    randomId,
    hashOpaqueToken,
    hashPassword: hashPasswordSync,
    verifyPassword: verifyPasswordSync,
    cleanupExpiredSessions,
    findActiveAdminUserByEmail(email) {
      const row = getDb().prepare(`
            SELECT id, email, password_hash, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `).get(email);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        name: row.name
      };
    },
    findActiveAdminUserIdByEmail(email) {
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").get(email)?.id ?? null;
    },
    insertSession({ sessionToken, userId, csrfToken, ipAddress, userAgent }) {
      getDb().prepare(`
            INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
          `).run(sessionToken, userId, csrfToken, ipAddress ?? null, userAgent ?? null);
    },
    findLiveSessionById(sessionToken) {
      const row = getDb().prepare(`
            SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name
            FROM admin_sessions s
            JOIN admin_users u ON u.id = s.user_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND u.active = 1
            LIMIT 1
          `).get(sessionToken);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        csrfToken: row.csrf_token,
        lastActiveAt: row.last_active_at,
        email: row.email,
        role: row.role,
        name: row.name
      };
    },
    touchSession(sessionToken) {
      getDb().prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionToken);
    },
    revokeSessionById(sessionToken) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND revoked_at IS NULL
          `).run(sessionToken);
    },
    findInviteTokenByHash(tokenHash) {
      const row = getDb().prepare(`
            SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at,
                   u.email, u.name, u.role, u.active
            FROM user_invites i
            JOIN admin_users u ON u.id = i.user_id
            WHERE i.token_hash = ?
            LIMIT 1
          `).get(tokenHash);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        active: row.active === 1
      };
    },
    updateAdminUserPassword(userId, passwordHash) {
      getDb().prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    },
    acceptInvitesForUser(userId) {
      getDb().prepare(`
            UPDATE user_invites
            SET accepted_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND accepted_at IS NULL
          `).run(userId);
    },
    findPasswordResetUserByEmail(email) {
      const row = getDb().prepare(`
            SELECT id, email, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `).get(email);
      return row ?? null;
    },
    consumePasswordResetTokensForUser(userId) {
      getDb().prepare(`
            UPDATE password_reset_tokens
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND consumed_at IS NULL
          `).run(userId);
    },
    insertPasswordResetToken({ tokenId, userId, tokenHash, expiresAt, requestedBy }) {
      getDb().prepare(`
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
            VALUES (?, ?, ?, ?, ?)
          `).run(tokenId, userId, tokenHash, expiresAt, requestedBy);
    },
    findPasswordResetTokenByHash(tokenHash) {
      const row = getDb().prepare(`
            SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at,
                   u.email, u.name, u.role, u.active
            FROM password_reset_tokens t
            JOIN admin_users u ON u.id = t.user_id
            WHERE t.token_hash = ?
            LIMIT 1
          `).get(tokenHash);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        active: row.active === 1
      };
    },
    markPasswordResetTokenConsumed(tokenId) {
      getDb().prepare("UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(tokenId);
    },
    revokeSessionsForUser(userId) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `).run(userId);
    },
    recordAuthAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
    }
  });
  function getRedirectRules() {
    const rows = getDb().prepare(`
          SELECT source_path, target_path, status_code
          FROM redirect_rules
          WHERE deleted_at IS NULL
          ORDER BY source_path ASC
        `).all();
    return rows.map((row) => ({
      sourcePath: row.source_path,
      targetPath: row.target_path,
      statusCode: row.status_code
    }));
  }
  const sqliteRedirectRepository = createAstropressRedirectRepository({
    getRedirectRules,
    normalizePath,
    getExistingRedirect(sourcePath) {
      const existing = getDb().prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1").get(sourcePath);
      return existing ? { deletedAt: existing.deleted_at } : null;
    },
    upsertRedirect({ sourcePath, targetPath, statusCode, actor }) {
      getDb().prepare(`
            INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
            VALUES (?, ?, ?, ?, NULL)
            ON CONFLICT(source_path) DO UPDATE SET
              target_path = excluded.target_path,
              status_code = excluded.status_code,
              created_by = excluded.created_by,
              deleted_at = NULL
          `).run(sourcePath, targetPath, statusCode, actor.email);
    },
    markRedirectDeleted(sourcePath) {
      return getDb().prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL").run(sourcePath).changes > 0;
    },
    recordRedirectAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "redirect", targetId);
    }
  });
  function getComments() {
    const rows = getDb().prepare(`
          SELECT id, author, email, body, route, status, policy, submitted_at
          FROM comments
          ORDER BY
            CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            datetime(submitted_at) DESC,
            id DESC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      author: row.author,
      email: row.email ?? undefined,
      body: row.body ?? undefined,
      route: row.route,
      status: row.status,
      policy: row.policy,
      submittedAt: row.submitted_at
    }));
  }
  const sqliteCommentRepository = createAstropressCommentRepository({
    getComments,
    getCommentRoute(commentId) {
      const comment = getDb().prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").get(commentId);
      return comment?.route ?? null;
    },
    updateCommentStatus(commentId, nextStatus) {
      return getDb().prepare("UPDATE comments SET status = ? WHERE id = ?").run(nextStatus, commentId).changes > 0;
    },
    insertPublicComment(comment) {
      const submittedAt = comment.submittedAt ?? new Date().toISOString();
      getDb().prepare(`
            INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(comment.id, comment.author, comment.email ?? null, comment.body ?? null, comment.route, comment.status, comment.policy, submittedAt);
      return submittedAt;
    },
    recordCommentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "comment", targetId);
    }
  });
  const sqliteContentRepository = createAstropressContentRepository({
    normalizePath,
    slugifyTerm,
    normalizeContentStatus,
    findContentRecord(slug) {
      const record = findPageRecord(slug);
      return record ? toContentRecord(record) : null;
    },
    listContentRecords() {
      return getAllContentRecords().map((record) => toContentRecord(record));
    },
    getPersistedOverride: getPersistedContentOverride,
    getContentAssignments(slug) {
      return getContentAssignmentIds(slug);
    },
    ensureBaselineRevision(record) {
      ensureBaselineRevision(record);
    },
    listPersistedRevisions(slug) {
      const rows = getDb().prepare(`
            SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                   og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
            FROM content_revisions
            WHERE slug = ?
            ORDER BY datetime(created_at) DESC, id DESC
          `).all(slug);
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduled_at ?? undefined,
        body: row.body ?? undefined,
        authorIds: parseIdList(row.author_ids),
        categoryIds: parseIdList(row.category_ids),
        tagIds: parseIdList(row.tag_ids),
        seoTitle: row.seo_title,
        metaDescription: row.meta_description,
        excerpt: row.excerpt ?? undefined,
        ogTitle: row.og_title ?? undefined,
        ogDescription: row.og_description ?? undefined,
        ogImage: row.og_image ?? undefined,
        canonicalUrlOverride: row.canonical_url_override ?? undefined,
        robotsDirective: row.robots_directive ?? undefined,
        source: row.source,
        createdAt: row.created_at,
        revisionNote: row.revision_note ?? undefined,
        createdBy: row.created_by ?? undefined
      }));
    },
    getPersistedRevision(slug, revisionId) {
      return this.listPersistedRevisions(slug).find((revision) => revision.id === revisionId) ?? null;
    },
    upsertContentOverride(slug, override, actor) {
      getDb().prepare(`
            INSERT INTO content_overrides (
              slug, title, status, body, seo_title, meta_description, excerpt, og_title,
              og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(slug) DO UPDATE SET
              title = excluded.title,
              status = excluded.status,
              body = excluded.body,
              seo_title = excluded.seo_title,
              meta_description = excluded.meta_description,
              excerpt = excluded.excerpt,
              og_title = excluded.og_title,
              og_description = excluded.og_description,
              og_image = excluded.og_image,
              scheduled_at = excluded.scheduled_at,
              canonical_url_override = excluded.canonical_url_override,
              robots_directive = excluded.robots_directive,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `).run(slug, override.title, override.status, override.body ?? null, override.seoTitle, override.metaDescription, override.excerpt ?? null, override.ogTitle ?? null, override.ogDescription ?? null, override.ogImage ?? null, override.scheduledAt ?? null, override.canonicalUrlOverride ?? null, override.robotsDirective ?? null, actor.email);
    },
    replaceContentAssignments(slug, assignments) {
      replaceContentAssignments(slug, assignments);
    },
    insertReviewedRevision(slug, revision, actor) {
      getDb().prepare(`
            INSERT INTO content_revisions (
              id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          `).run(`revision-${randomId()}`, slug, revision.title, revision.status, revision.scheduledAt ?? null, revision.body ?? null, revision.seoTitle, revision.metaDescription, revision.excerpt ?? null, revision.ogTitle ?? null, revision.ogDescription ?? null, revision.ogImage ?? null, serializeIdList(revision.authorIds), serializeIdList(revision.categoryIds), serializeIdList(revision.tagIds), revision.canonicalUrlOverride ?? null, revision.robotsDirective ?? null, revision.revisionNote ?? null, actor.email);
    },
    insertContentEntry(entry) {
      try {
        getDb().prepare(`
              INSERT INTO content_entries (
                slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                seo_title, meta_description, og_title, og_description, og_image
              ) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
            `).run(entry.slug, entry.legacyUrl, entry.title, `runtime://content/${entry.slug}`, entry.body, entry.summary, entry.seoTitle, entry.metaDescription, entry.ogTitle ?? null, entry.ogDescription ?? null, entry.ogImage ?? null);
        return true;
      } catch {
        return false;
      }
    },
    recordContentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    }
  });
  function getContactSubmissions() {
    const rows = getDb().prepare(`
          SELECT id, name, email, message, submitted_at
          FROM contact_submissions
          ORDER BY datetime(submitted_at) DESC, id DESC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      submittedAt: row.submitted_at
    }));
  }
  const sqliteSubmissionRepository = createAstropressSubmissionRepository({
    getContactSubmissions,
    insertContactSubmission(submission) {
      getDb().prepare(`
            INSERT INTO contact_submissions (id, name, email, message, submitted_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(submission.id, submission.name, submission.email, submission.message, submission.submittedAt);
    }
  });
  const sqliteTranslationRepository = createAstropressTranslationRepository({
    readTranslationState(route) {
      const row = getDb().prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1").get(route);
      return row?.state;
    },
    persistTranslationState(route, state, actor) {
      getDb().prepare(`
            INSERT INTO translation_overrides (route, state, updated_at, updated_by)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(route) DO UPDATE SET
              state = excluded.state,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `).run(route, state, actor.email);
    },
    recordTranslationAudit({ actor, route, state }) {
      recordAudit(actor, "translation.update", `Updated translation state for ${route} to ${state}.`, "content", route);
    }
  });
  function getSettings() {
    const row = getDb().prepare(`
          SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
          FROM site_settings
          WHERE id = 1
          LIMIT 1
        `).get();
    if (!row) {
      return { ...defaultSiteSettings };
    }
    return {
      siteTitle: row.site_title,
      siteTagline: row.site_tagline,
      donationUrl: row.donation_url,
      newsletterEnabled: row.newsletter_enabled === 1,
      commentsDefaultPolicy: row.comments_default_policy,
      adminSlug: row.admin_slug ?? "wp-admin"
    };
  }
  const sqliteSettingsRepository = createAstropressSettingsRepository({
    getSettings,
    persistSettings(updated, actor) {
      getDb().prepare(`
            INSERT INTO site_settings (
              id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(id) DO UPDATE SET
              site_title = excluded.site_title,
              site_tagline = excluded.site_tagline,
              donation_url = excluded.donation_url,
              newsletter_enabled = excluded.newsletter_enabled,
              comments_default_policy = excluded.comments_default_policy,
              admin_slug = excluded.admin_slug,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `).run(1, updated.siteTitle, updated.siteTagline, updated.donationUrl, updated.newsletterEnabled ? 1 : 0, updated.commentsDefaultPolicy, updated.adminSlug, actor.email);
    },
    recordSettingsAudit(actor) {
      recordAudit(actor, "settings.update", "Updated site settings.", "auth", "site-settings");
    }
  });
  function listSystemRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'system'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      bodyHtml: row.body_html ?? undefined,
      settings: parseSystemSettings(row.settings_json),
      updatedAt: row.updated_at ?? undefined,
      renderStrategy: row.render_strategy
    }));
  }
  function getSystemRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listSystemRoutes().find((route) => route.path === normalizedPath) ?? null;
  }
  function listStructuredPageRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                 v.og_image, v.sections_json, v.settings_json, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => {
      const settings = parseSystemSettings(row.settings_json) ?? {};
      const templateKey = normalizeStructuredTemplateKey(settings.templateKey);
      if (!templateKey) {
        return null;
      }
      return {
        path: row.path,
        title: row.title,
        summary: row.summary ?? undefined,
        seoTitle: row.seo_title ?? undefined,
        metaDescription: row.meta_description ?? undefined,
        canonicalUrlOverride: row.canonical_url_override ?? undefined,
        robotsDirective: row.robots_directive ?? undefined,
        ogImage: row.og_image ?? undefined,
        templateKey,
        alternateLinks: Array.isArray(settings.alternateLinks) ? settings.alternateLinks : [],
        sections: parseSystemSettings(row.sections_json),
        updatedAt: row.updated_at ?? undefined
      };
    }).filter(Boolean);
  }
  function getStructuredPageRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listStructuredPageRoutes().find((route) => route.path === normalizedPath) ?? null;
  }
  function getArchiveRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    const row = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive' AND v.path = ?
          LIMIT 1
        `).get(normalizedPath);
    if (!row) {
      return null;
    }
    return {
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      metaDescription: row.meta_description ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
      updatedAt: row.updated_at ?? undefined
    };
  }
  function listArchiveRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      metaDescription: row.meta_description ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
      updatedAt: row.updated_at ?? undefined
    }));
  }
  const sqliteCmsRouteRegistry = createAstropressCmsRouteRegistry({
    normalizePath: normalizeSystemRoutePath,
    localeFromPath,
    listSystemRoutes,
    getSystemRoute,
    listStructuredPageRoutes,
    getStructuredPageRoute,
    getArchiveRoute,
    listArchiveRoutes,
    findSystemRouteForUpdate(pathname) {
      const row = getDb().prepare(`
            SELECT v.id, g.render_strategy
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'system' AND v.path = ?
            LIMIT 1
          `).get(pathname);
      return row ? { id: row.id, renderStrategy: row.render_strategy } : null;
    },
    persistSystemRoute({ routeId, title, summary, bodyHtml, settingsJson, actor }) {
      getDb().prepare(`
            UPDATE cms_route_variants
            SET
              title = ?,
              summary = ?,
              body_html = ?,
              settings_json = ?,
              seo_title = ?,
              meta_description = ?,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = ?
            WHERE id = ?
          `).run(title, summary, bodyHtml, settingsJson, title, summary ?? title, actor.email, routeId);
    },
    appendSystemRouteRevision({ routeId, pathname, locale, title, summary, bodyHtml, settings, renderStrategy, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, locale, JSON.stringify({ path: pathname, title, summary, bodyHtml, settings: settings ?? null, renderStrategy }), revisionNote, actor.email);
    },
    isRoutePathTaken(pathname) {
      return Boolean(getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE v.path = ?
              LIMIT 1
            `).get(pathname));
    },
    findStructuredRouteForUpdate(pathname) {
      return getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
              LIMIT 1
            `).get(pathname) ?? null;
    },
    insertStructuredRoute({ pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      const groupId = `route-group:${randomId()}`;
      const variantId = `route-variant:${randomId()}`;
      getDb().prepare(`
            INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
            VALUES (?, 'page', 'structured_sections', ?, ?)
          `).run(groupId, locale, pathname);
      getDb().prepare(`
            INSERT INTO cms_route_variants (
              id, group_id, locale, path, status, title, summary, sections_json, settings_json,
              seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by
            ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(variantId, groupId, locale, pathname, title, summary, sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }), seoTitle, metaDescription, ogImage, canonicalUrlOverride, robotsDirective, actor.email);
    },
    persistStructuredRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      getDb().prepare(`
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `).run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }), actor.email, routeId);
    },
    appendStructuredRouteRevision({ routeId, pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, locale, JSON.stringify({
        path: pathname,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey,
        alternateLinks,
        sections
      }), revisionNote, actor.email);
    },
    findArchiveRouteForUpdate(pathname) {
      return getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'archive' AND v.path = ?
              LIMIT 1
            `).get(pathname) ?? null;
    },
    persistArchiveRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor }) {
      getDb().prepare(`
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `).run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor.email, routeId);
    },
    appendArchiveRouteRevision({ routeId, pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, 'en', ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, JSON.stringify({ path: pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective }), revisionNote, actor.email);
    },
    recordRouteAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    }
  });
  const sqliteCmsRegistryModule = createAstropressCmsRegistryModule({
    listSystemRoutes,
    getSystemRoute,
    saveSystemRoute: sqliteCmsRouteRegistry.saveSystemRoute,
    listStructuredPageRoutes,
    getStructuredPageRoute,
    saveStructuredPageRoute: sqliteCmsRouteRegistry.saveStructuredPageRoute,
    createStructuredPageRoute: sqliteCmsRouteRegistry.createStructuredPageRoute,
    getArchiveRoute,
    listArchiveRoutes,
    saveArchiveRoute: sqliteCmsRouteRegistry.saveArchiveRoute
  });
  const sqliteRateLimitRepository = createAstropressRateLimitRepository({
    now,
    readRateLimitWindow(key) {
      const row = getDb().prepare("SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1").get(key);
      if (!row) {
        return null;
      }
      return {
        count: row.count,
        windowStartMs: row.window_start_ms,
        windowMs: row.window_ms
      };
    },
    resetRateLimitWindow(key, currentTime, windowMs) {
      getDb().prepare(`
            INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              count = 1,
              window_start_ms = excluded.window_start_ms,
              window_ms = excluded.window_ms
          `).run(key, currentTime, windowMs);
    },
    incrementRateLimitWindow(key) {
      getDb().prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    }
  });
  function listMediaAssets() {
    const rows = getDb().prepare(`
          SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
          FROM media_assets
          WHERE deleted_at IS NULL
          ORDER BY datetime(uploaded_at) DESC, id DESC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      sourceUrl: row.source_url,
      localPath: row.local_path,
      r2Key: row.r2_key,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      fileSize: row.file_size,
      altText: row.alt_text ?? "",
      title: row.title ?? "",
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by ?? ""
    }));
  }
  function listAuthors() {
    const rows = getDb().prepare(`
          SELECT id, slug, name, bio, created_at, updated_at
          FROM authors
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      bio: row.bio ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  const sqliteAuthorRepository = createAstropressAuthorRepository({
    listAuthors,
    slugifyTerm,
    createAuthor({ slug, name, bio }) {
      try {
        getDb().prepare(`
              INSERT INTO authors (slug, name, bio)
              VALUES (?, ?, ?)
            `).run(slug, name, bio);
        return true;
      } catch {
        return false;
      }
    },
    updateAuthor({ id, slug, name, bio }) {
      try {
        const result = getDb().prepare(`
              UPDATE authors
              SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND deleted_at IS NULL
            `).run(slug, name, bio, id);
        return result.changes > 0;
      } catch {
        return false;
      }
    },
    deleteAuthor(id) {
      return getDb().prepare("UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").run(id).changes > 0;
    },
    recordAuthorAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    }
  });
  function listTaxonomyTerms(table, kind) {
    const rows = getDb().prepare(`
          SELECT id, slug, name, description, created_at, updated_at
          FROM ${table}
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      kind,
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  const sqliteTaxonomyRepository = createAstropressTaxonomyRepository({
    listCategories() {
      return listTaxonomyTerms("categories", "category");
    },
    listTags() {
      return listTaxonomyTerms("tags", "tag");
    },
    slugifyTerm,
    createTaxonomyTerm({ table, slug, name, description }) {
      try {
        getDb().prepare(`INSERT INTO ${table} (slug, name, description) VALUES (?, ?, ?)`).run(slug, name, description);
        return true;
      } catch {
        return false;
      }
    },
    updateTaxonomyTerm({ table, id, slug, name, description }) {
      try {
        const result = getDb().prepare(`UPDATE ${table} SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).run(slug, name, description, id);
        return result.changes > 0;
      } catch {
        return false;
      }
    },
    deleteTaxonomyTerm({ table, id }) {
      return getDb().prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).run(id).changes > 0;
    },
    recordTaxonomyAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    }
  });
  function updateMediaAsset(input, actor) {
    const id = input.id.trim();
    if (!id) {
      return { ok: false, error: "Media asset id is required." };
    }
    const result = getDb().prepare("UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL").run(input.title?.trim() ?? "", input.altText?.trim() ?? "", id);
    if (result.changes === 0) {
      return { ok: false, error: "The selected media asset could not be updated." };
    }
    recordAudit(actor, "media.update", `Updated media metadata for ${id}.`, "content", id);
    return { ok: true };
  }
  const sqliteMediaRepository = createAstropressLocalMediaRepository({
    listMediaAssets,
    updateMediaAsset,
    insertStoredMediaAsset({ asset, actor }) {
      getDb().prepare(`
            INSERT INTO media_assets (
              id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(asset.id, null, asset.publicPath, asset.r2Key, asset.mimeType, asset.fileSize, asset.altText, asset.title, actor.email);
    },
    getStoredMediaDeletionCandidate(id) {
      const row = getDb().prepare("SELECT local_path FROM media_assets WHERE id = ? AND deleted_at IS NULL").get(id);
      return row ? { localPath: row.local_path } : null;
    },
    markStoredMediaDeleted(id) {
      return getDb().prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id).changes > 0;
    },
    recordMediaAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    }
  });
  const sqliteAdminStore = createAstropressAdminStoreAdapter("sqlite", {
    auth: {
      createSession: sqliteAuthRepository.createSession,
      getSessionUser: sqliteAuthRepository.getSessionUser,
      getCsrfToken: sqliteAuthRepository.getCsrfToken,
      revokeSession: sqliteAuthRepository.revokeSession,
      createPasswordResetToken: sqliteAuthRepository.createPasswordResetToken,
      getInviteRequest: sqliteAuthRepository.getInviteRequest,
      getPasswordResetRequest: sqliteAuthRepository.getPasswordResetRequest,
      consumeInviteToken: sqliteAuthRepository.consumeInviteToken,
      consumePasswordResetToken: sqliteAuthRepository.consumePasswordResetToken,
      recordSuccessfulLogin: sqliteAuthRepository.recordSuccessfulLogin,
      recordLogout: sqliteAuthRepository.recordLogout
    },
    audit: {
      getAuditEvents: getPersistedAuditEvents
    },
    users: {
      listAdminUsers,
      inviteAdminUser: sqliteUserRepository.inviteAdminUser,
      suspendAdminUser: sqliteUserRepository.suspendAdminUser,
      unsuspendAdminUser: sqliteUserRepository.unsuspendAdminUser
    },
    authors: {
      listAuthors,
      createAuthor: sqliteAuthorRepository.createAuthor,
      updateAuthor: sqliteAuthorRepository.updateAuthor,
      deleteAuthor: sqliteAuthorRepository.deleteAuthor
    },
    taxonomies: {
      listCategories: sqliteTaxonomyRepository.listCategories,
      createCategory: sqliteTaxonomyRepository.createCategory,
      updateCategory: sqliteTaxonomyRepository.updateCategory,
      deleteCategory: sqliteTaxonomyRepository.deleteCategory,
      listTags: sqliteTaxonomyRepository.listTags,
      createTag: sqliteTaxonomyRepository.createTag,
      updateTag: sqliteTaxonomyRepository.updateTag,
      deleteTag: sqliteTaxonomyRepository.deleteTag
    },
    redirects: {
      getRedirectRules,
      createRedirectRule: sqliteRedirectRepository.createRedirectRule,
      deleteRedirectRule: sqliteRedirectRepository.deleteRedirectRule
    },
    comments: {
      getComments,
      moderateComment: sqliteCommentRepository.moderateComment,
      submitPublicComment: sqliteCommentRepository.submitPublicComment,
      getApprovedCommentsForRoute: sqliteCommentRepository.getApprovedCommentsForRoute
    },
    content: {
      listContentStates: sqliteContentRepository.listContentStates,
      getContentState: sqliteContentRepository.getContentState,
      getContentRevisions: sqliteContentRepository.getContentRevisions,
      createContentRecord: sqliteContentRepository.createContentRecord,
      saveContentState: sqliteContentRepository.saveContentState,
      restoreRevision: sqliteContentRepository.restoreRevision
    },
    submissions: {
      submitContact: sqliteSubmissionRepository.submitContact,
      getContactSubmissions
    },
    translations: {
      updateTranslationState: sqliteTranslationRepository.updateTranslationState,
      getEffectiveTranslationState: sqliteTranslationRepository.getEffectiveTranslationState
    },
    settings: {
      getSettings,
      saveSettings: sqliteSettingsRepository.saveSettings
    },
    rateLimits: {
      checkRateLimit: sqliteRateLimitRepository.checkRateLimit,
      peekRateLimit: sqliteRateLimitRepository.peekRateLimit,
      recordFailedAttempt: sqliteRateLimitRepository.recordFailedAttempt
    },
    media: {
      listMediaAssets,
      createMediaAsset: sqliteMediaRepository.createMediaAsset,
      updateMediaAsset,
      deleteMediaAsset: sqliteMediaRepository.deleteMediaAsset
    }
  });
  return {
    sqliteAdminStore,
    sqliteCmsRegistryModule,
    authenticatePersistedAdminUser: sqliteAuthRepository.authenticatePersistedAdminUser
  };
}
export {
  createAstropressSqliteAdminRuntime
};
