// ─── Admin Editor Page Models ─────────────────────────────────────────────────
// Extracted from admin-page-models.ts to keep that file under the 400-line limit.
// Contains single-record editor page models (post editor, route editor, archive editor, auth pages).

import type { APIContext } from "astro";
import { getAdminLocalePair } from "./admin-locale-links";
import { ok, notFound, forbidden, withFallback, type AdminPageResult } from "./admin-page-model-helpers";
import {
  getRuntimeAuditEvents,
  getRuntimeAuthors,
  getRuntimeCategories,
  getRuntimeContentRevisions,
  getRuntimeContentState,
  getRuntimeContentStateByPath,
  getRuntimeTags,
  getRuntimeTranslationState,
} from "./runtime-page-store";
import { getRuntimeInviteRequest, getRuntimePasswordResetRequest } from "./runtime-admin-actions";
import { getRuntimeStructuredPageRoute, getRuntimeArchiveRoute } from "./runtime-route-registry";

type AdminLocals = APIContext["locals"];
type AdminRole = "admin" | "editor";

export async function buildPostEditorPageModel(locals: AdminLocals, slug: string) {
  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The content record could not be loaded.", () => getRuntimeContentState(slug, locals), null);
  if (!pageRecord) {
    return notFound({
      pageRecord: null,
      authors: [],
      categories: [],
      tags: [],
      auditEvents: [],
      englishOwnerRecord: null,
      localizedRouteRecord: null,
      effectiveTranslationState: undefined,
    }, warnings);
  }

  const authors = await withFallback(warnings, "Authors are temporarily unavailable.", () => getRuntimeAuthors(locals), []);
  const categories = await withFallback(warnings, "Categories are temporarily unavailable.", () => getRuntimeCategories(locals), []);
  const tags = await withFallback(warnings, "Tags are temporarily unavailable.", () => getRuntimeTags(locals), []);
  const auditEvents = await withFallback(warnings, "Audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []);
  const localePair = getAdminLocalePair(pageRecord.legacyUrl);
  const localizedRoutePath = localePair?.localizedRoute;
  const fallbackTranslationState = localePair?.translationState ?? "not_started";
  const englishOwnerRecord = localePair?.englishRoute && localePair.englishRoute !== pageRecord.legacyUrl
    ? await withFallback(warnings, "The linked English owner record is temporarily unavailable.", () => getRuntimeContentStateByPath(localePair.englishRoute, locals), null)
    : pageRecord;
  const localizedRouteRecord = localizedRoutePath
    ? await withFallback(warnings, "The linked locale route is temporarily unavailable.", () => getRuntimeStructuredPageRoute(localizedRoutePath, locals), null)
    : null;
  const effectiveTranslationState = localizedRoutePath
    ? await withFallback(warnings, "Translation state is temporarily unavailable.", () => getRuntimeTranslationState(localizedRoutePath, fallbackTranslationState, locals), fallbackTranslationState)
    : undefined;

  return ok({ pageRecord, authors, categories, tags, auditEvents, englishOwnerRecord, localizedRouteRecord, effectiveTranslationState }, warnings);
}

export async function buildPostRevisionsPageModel(locals: AdminLocals, slug: string) {
  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The content record could not be loaded.", () => getRuntimeContentState(slug, locals), null);
  const revisions = pageRecord
    ? await withFallback(warnings, "Revision history is temporarily unavailable.", () => getRuntimeContentRevisions(slug, locals), null)
    : null;

  if (!pageRecord || !revisions) {
    return notFound({ pageRecord: null, revisions: null, auditEvents: [], authors: [], categories: [], tags: [] }, warnings);
  }

  const auditEvents = await withFallback(warnings, "Audit history is temporarily unavailable.", () => getRuntimeAuditEvents(locals), []);
  const authors = await withFallback(warnings, "Authors are temporarily unavailable.", () => getRuntimeAuthors(locals), []);
  const categories = await withFallback(warnings, "Categories are temporarily unavailable.", () => getRuntimeCategories(locals), []);
  const tags = await withFallback(warnings, "Tags are temporarily unavailable.", () => getRuntimeTags(locals), []);

  return ok({ pageRecord, revisions, auditEvents, authors, categories, tags }, warnings);
}

export async function buildRoutePageEditorModel(locals: AdminLocals, routePath: string, role: AdminRole): Promise<AdminPageResult<{ pageRecord: Awaited<ReturnType<typeof getRuntimeStructuredPageRoute>>; englishOwner: Awaited<ReturnType<typeof getRuntimeContentStateByPath>> | null; effectiveTranslationState: string | undefined }>> {
  const empty = { pageRecord: null, englishOwner: null, effectiveTranslationState: undefined };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const pageRecord = await withFallback(warnings, "The route page could not be loaded.", () => getRuntimeStructuredPageRoute(routePath, locals), null);
  if (!pageRecord) {
    return notFound(empty, warnings);
  }

  const localePair = getAdminLocalePair(routePath);
  const localizedRoutePath = localePair?.localizedRoute;
  const fallbackTranslationState = localePair?.translationState ?? "not_started";
  const englishOwner = localePair
    ? await withFallback(warnings, "The linked English owner record is temporarily unavailable.", () => getRuntimeContentStateByPath(localePair.englishRoute, locals), null)
    : null;
  const effectiveTranslationState = localizedRoutePath
    ? await withFallback(warnings, "Translation state is temporarily unavailable.", () => getRuntimeTranslationState(localizedRoutePath, fallbackTranslationState, locals), fallbackTranslationState)
    : undefined;

  return ok({ pageRecord, englishOwner, effectiveTranslationState }, warnings);
}

export async function buildArchiveEditorModel(locals: AdminLocals, archivePath: string, role: AdminRole) {
  const empty = { archive: null };
  if (role !== "admin") {
    return forbidden(empty);
  }

  const warnings: string[] = [];
  const archive = await withFallback(warnings, "The archive record could not be loaded.", () => getRuntimeArchiveRoute(archivePath, locals), null);
  if (!archive) {
    return notFound(empty, warnings);
  }

  return ok({ archive }, warnings);
}

export async function buildResetPasswordPageModel(locals: AdminLocals, token: string) {
  const warnings: string[] = [];
  const request = token
    ? await withFallback(warnings, "The reset token could not be validated.", () => getRuntimePasswordResetRequest(token, locals), null)
    : null;
  return ok({ request }, warnings);
}

export async function buildAcceptInvitePageModel(locals: AdminLocals, token: string) {
  const warnings: string[] = [];
  const inviteRequest = token
    ? await withFallback(warnings, "The invite token could not be validated.", () => getRuntimeInviteRequest(token, locals), null)
    : null;
  return ok({ inviteRequest }, warnings);
}
