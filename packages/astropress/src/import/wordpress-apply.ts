import { stat } from "node:fs/promises";
import path from "node:path";
import type { AstropressWordPressImportLocalApplyReport, AstropressWordPressImportPlan } from "../platform-contracts";
import { createDefaultAstropressSqliteSeedToolkit } from "../sqlite-bootstrap";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime";
import type { ParsedBundle } from "./wordpress-xml.js";

const SQL_UPSERT_CATEGORY = `INSERT INTO categories (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`;
const SQL_UPSERT_TAG = `INSERT INTO tags (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`;
const SQL_SELECT_CATEGORY_ID = "SELECT id FROM categories WHERE slug = ? LIMIT 1";
const SQL_SELECT_TAG_ID = "SELECT id FROM tags WHERE slug = ? LIMIT 1";
const SQL_UPDATE_ENTRY_LEGACY = "UPDATE content_entries SET legacy_url = ?, summary = ?, kind = ? WHERE slug = ?";
const SQL_UPSERT_AUTHOR = `INSERT INTO authors (slug, name, bio, deleted_at) VALUES (?, ?, ?, NULL) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, bio = excluded.bio, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`;
const SQL_SELECT_AUTHOR_ID = "SELECT id FROM authors WHERE slug = ? LIMIT 1";
const SQL_UPSERT_MEDIA = `INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, uploaded_by = excluded.uploaded_by, deleted_at = NULL`;
const SQL_UPSERT_COMMENT = `INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET author = excluded.author, email = excluded.email, body = excluded.body, route = excluded.route, status = excluded.status, policy = excluded.policy, submitted_at = excluded.submitted_at`;
const SQL_UPSERT_REDIRECT = `INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status_code = excluded.status_code, created_by = excluded.created_by, deleted_at = NULL`;

const WORDPRESS_IMPORT_ACTOR = {
  email: "wordpress-import@astropress.local",
  role: "admin" as const,
  name: "WordPress Import",
};

export function resolveLocalAdminDbPath(workspaceRoot: string, adminDbPath?: string) {
  if (adminDbPath) {
    return path.isAbsolute(adminDbPath) ? adminDbPath : path.join(workspaceRoot, adminDbPath);
  }
  return createDefaultAstropressSqliteSeedToolkit().getDefaultAdminDbPath(workspaceRoot);
}

export async function fileSizeOrNull(targetPath: string) {
  try {
    const details = await stat(targetPath);
    return details.size;
  } catch {
    return null;
  }
}

type AdminDb = ReturnType<ReturnType<typeof createDefaultAstropressSqliteSeedToolkit>["openSeedDatabase"]>;
type AdminRuntime = ReturnType<typeof createAstropressSqliteAdminRuntime>;

function importTerms(
  db: AdminDb, bundle: ParsedBundle,
): { categoryIdsBySlug: Map<string, number>; tagIdsBySlug: Map<string, number> } {
  const upsertCategory = db.prepare(SQL_UPSERT_CATEGORY);
  const upsertTag = db.prepare(SQL_UPSERT_TAG);
  const selectCategoryId = db.prepare(SQL_SELECT_CATEGORY_ID);
  const selectTagId = db.prepare(SQL_SELECT_TAG_ID);
  const categoryIdsBySlug = new Map<string, number>();
  const tagIdsBySlug = new Map<string, number>();
  for (const term of bundle.terms) {
    if (term.kind === "category") {
      upsertCategory.run(term.slug, term.name, null);
      const row = selectCategoryId.get(term.slug) as { id: number } | undefined;
      if (row) categoryIdsBySlug.set(term.slug, row.id);
    } else {
      upsertTag.run(term.slug, term.name, null);
      const row = selectTagId.get(term.slug) as { id: number } | undefined;
      if (row) tagIdsBySlug.set(term.slug, row.id);
    }
  }
  return { categoryIdsBySlug, tagIdsBySlug };
}

function importContentRecords(
  db: AdminDb, runtime: AdminRuntime, bundle: ParsedBundle,
  authorIdsByLogin: Map<string, number>, categoryIdsBySlug: Map<string, number>, tagIdsBySlug: Map<string, number>,
): Map<string, string> {
  const contentRouteByImportId = new Map<string, string>();
  for (const record of bundle.contentRecords) {
    const existing = runtime.sqliteAdminStore.content.getContentState(record.slug);
    const contentStatus = record.status === "archived" ? "archived" : record.status === "draft" ? "draft" : "published";
    const authorIds = record.authorLogins.map((l) => authorIdsByLogin.get(l)).filter((v): v is number => typeof v === "number");
    const categoryIds = record.categorySlugs.map((s) => categoryIdsBySlug.get(s)).filter((v): v is number => typeof v === "number");
    const tagIds = record.tagSlugs.map((s) => tagIdsBySlug.get(s)).filter((v): v is number => typeof v === "number");
    const revisionInput = {
      title: record.title, status: contentStatus, body: record.body,
      seoTitle: record.title, metaDescription: record.excerpt ?? record.title,
      excerpt: record.excerpt, authorIds, categoryIds, tagIds,
      revisionNote: `WordPress import ${record.legacyId}`,
    };

    if (existing) {
      const result = runtime.sqliteAdminStore.content.saveContentState(record.slug, revisionInput, WORDPRESS_IMPORT_ACTOR);
      if (!result.ok) throw new Error(result.error);
      db.prepare(SQL_UPDATE_ENTRY_LEGACY).run(record.legacyUrl, record.excerpt ?? "", record.kind, record.slug);
    } else {
      const created = runtime.sqliteAdminStore.content.createContentRecord(
        { title: record.title, slug: record.slug, legacyUrl: record.legacyUrl, body: record.body, summary: record.excerpt ?? "", status: contentStatus, seoTitle: record.title, metaDescription: record.excerpt ?? record.title, excerpt: record.excerpt },
        WORDPRESS_IMPORT_ACTOR,
      );
      if (!created.ok) throw new Error(created.error);
      const saved = runtime.sqliteAdminStore.content.saveContentState(record.slug, revisionInput, WORDPRESS_IMPORT_ACTOR);
      if (!saved.ok) throw new Error(saved.error);
      db.prepare("UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?").run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
    }
    contentRouteByImportId.set(record.id, record.legacyUrl);
    contentRouteByImportId.set(record.legacyId, record.legacyUrl);
  }
  return contentRouteByImportId;
}

async function importMediaAssets(
  db: AdminDb, bundle: ParsedBundle, artifactDir: string | undefined,
) {
  const upsertMedia = db.prepare(SQL_UPSERT_MEDIA);
  for (const asset of bundle.mediaAssets) {
    const downloadedPath = artifactDir ? path.join(artifactDir, "downloads", asset.filename) : undefined;
    const hasDownloadedFile = downloadedPath ? await fileSizeOrNull(downloadedPath) !== null : false;
    const localPath = hasDownloadedFile ? downloadedPath! : asset.legacyUrl;
    upsertMedia.run(
      asset.id, asset.sourceUrl, localPath, asset.mimeType,
      hasDownloadedFile ? await fileSizeOrNull(downloadedPath!) : null,
      "", asset.title, WORDPRESS_IMPORT_ACTOR.email,
    );
  }
}

export async function applyImportToLocalRuntime(input: {
  bundle: ParsedBundle;
  artifactDir?: string;
  workspaceRoot: string;
  adminDbPath?: string;
  plan: AstropressWordPressImportPlan;
}): Promise<AstropressWordPressImportLocalApplyReport> {
  const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
  const resolvedDbPath = resolveLocalAdminDbPath(input.workspaceRoot, input.adminDbPath);
  seedToolkit.seedDatabase({ dbPath: resolvedDbPath, workspaceRoot: input.workspaceRoot });

  const db = seedToolkit.openSeedDatabase(resolvedDbPath);
  const runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => db });

  try {
    db.exec("BEGIN");

    const upsertAuthor = db.prepare(SQL_UPSERT_AUTHOR);
    const selectAuthorId = db.prepare(SQL_SELECT_AUTHOR_ID);
    const authorIdsByLogin = new Map<string, number>();
    if (input.plan.includeUsers) {
      for (const author of input.bundle.authors) {
        upsertAuthor.run(author.login, author.displayName, null);
        const row = selectAuthorId.get(author.login) as { id: number } | undefined;
        if (row) authorIdsByLogin.set(author.login, row.id);
      }
    }

    const { categoryIdsBySlug, tagIdsBySlug } = importTerms(db, input.bundle);
    const contentRouteByImportId = importContentRecords(db, runtime, input.bundle, authorIdsByLogin, categoryIdsBySlug, tagIdsBySlug);

    const upsertComment = db.prepare(SQL_UPSERT_COMMENT);
    const upsertRedirect = db.prepare(SQL_UPSERT_REDIRECT);
    if (input.plan.includeComments) {
      for (const comment of input.bundle.comments) {
        upsertComment.run(
          comment.id, comment.authorName, comment.authorEmail ?? null, comment.body,
          contentRouteByImportId.get(comment.recordId) ?? "/",
          comment.status, "legacy-readonly", comment.createdAt ?? new Date().toISOString(),
        );
      }
    }

    if (input.plan.includeMedia) {
      await importMediaAssets(db, input.bundle, input.artifactDir);
    }

    for (const redirect of input.bundle.redirects) {
      upsertRedirect.run(redirect.sourcePath, redirect.targetPath, 301, WORDPRESS_IMPORT_ACTOR.email);
    }

    db.exec("COMMIT");
    return {
      runtime: "sqlite-local",
      workspaceRoot: input.workspaceRoot,
      adminDbPath: resolvedDbPath,
      appliedRecords: input.bundle.contentRecords.length,
      appliedMedia: input.plan.includeMedia ? input.bundle.mediaAssets.length : 0,
      appliedComments: input.plan.includeComments ? input.bundle.comments.length : 0,
      appliedUsers: input.plan.includeUsers ? input.bundle.authors.length : 0,
      appliedRedirects: input.bundle.redirects.length,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}
