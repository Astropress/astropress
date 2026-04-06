import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultAstropressSqliteSeedToolkit } from "../sqlite-bootstrap.js";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime.js";

const WORDPRESS_IMPORT_ACTOR = {
  email: "wordpress-import@astropress.local",
  role: "admin",
  name: "WordPress Import"
};

const XML_ENTITY_LOOKUP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\""
};

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXml(value) {
  return stripCdata(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === "#") {
      const numeric = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
    return XML_ENTITY_LOOKUP[code.toLowerCase()] ?? entity;
  });
}

function getTagText(block, tagName) {
  const match = block.match(new RegExp(`<${escapeRegExp(tagName)}(?:\\b[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function getBlocks(block, tagName) {
  return [...block.matchAll(new RegExp(`<${escapeRegExp(tagName)}(?:\\b[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "gi"))].map((match) => match[1]);
}

function parseCategoryBlocks(block) {
  return [...block.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/gi)].map((match) => ({
    attributes: match[1],
    value: decodeXml(match[2].trim())
  }));
}

function getAttributeValue(attributes, attributeName) {
  const match = attributes.match(new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function normalizeSlug(value, fallback) {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-/]+|[-/]+$/g, "");
  return sanitized || fallback;
}

function normalizePathname(value, fallbackSlug) {
  if (!value) {
    return `/${fallbackSlug}/`;
  }
  try {
    const url = new URL(value, "https://wordpress.invalid");
    const pathname = url.pathname.replace(/\/{2,}/g, "/");
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  } catch {
    return `/${fallbackSlug}/`;
  }
}

function normalizeContentStatus(value) {
  switch (value.trim().toLowerCase()) {
    case "publish":
      return "published";
    case "draft":
    case "pending":
    case "future":
      return "draft";
    default:
      return "archived";
  }
}

function inferMimeType(filename) {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function filenameFromUrl(sourceUrl, fallback) {
  try {
    const url = new URL(sourceUrl);
    const candidate = path.basename(url.pathname);
    return candidate || fallback;
  } catch {
    return fallback;
  }
}

function safeArtifactFilename(filename, fallback) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-");
  return sanitized || fallback;
}

function detectUnsupportedPatterns(source) {
  const shortcodeMatches = countMatches(source, /\[[a-z][^\]]*\]/gi);
  const builderMatches = countMatches(source, /(elementor|vc_row|wp-block-|et_pb_|fusion_)/gi);
  const unsupportedPatterns = [];
  const warnings = [];
  if (shortcodeMatches > 0) {
    unsupportedPatterns.push("shortcodes");
    warnings.push("WordPress shortcodes were detected; staged content will need manual review.");
  }
  if (builderMatches > 0) {
    unsupportedPatterns.push("page-builder-markup");
    warnings.push("WordPress page-builder markup was detected; staged content will need manual cleanup.");
  }
  return {
    shortcodeMatches,
    builderMatches,
    unsupportedPatterns,
    warnings
  };
}

function buildUnsupportedSource(bundle) {
  return bundle.contentRecords.map((record) => `${record.body}\n${record.excerpt ?? ""}`).join("\n");
}

function parseWordPressExport(source) {
  const authors = getBlocks(source, "wp:author").map((block, index) => ({
    id: getTagText(block, "wp:author_id") || `author-${index + 1}`,
    login: normalizeSlug(getTagText(block, "wp:author_login"), `author-${index + 1}`),
    email: getTagText(block, "wp:author_email") || void 0,
    displayName: getTagText(block, "wp:author_display_name") || getTagText(block, "wp:author_login") || `Author ${index + 1}`
  }));
  const termsByKey = /* @__PURE__ */ new Map();
  const contentRecords = [];
  const mediaAssets = [];
  const comments = [];
  const redirects = [];
  let skipped = 0;
  const items = getBlocks(source, "item");
  for (const [index, item] of items.entries()) {
    const legacyId = getTagText(item, "wp:post_id") || `item-${index + 1}`;
    const postType = getTagText(item, "wp:post_type").toLowerCase();
    const postStatus = normalizeContentStatus(getTagText(item, "wp:status"));
    const title = getTagText(item, "title") || `Untitled ${legacyId}`;
    const legacyUrl = normalizePathname(getTagText(item, "link") || getTagText(item, "guid"), normalizeSlug(getTagText(item, "wp:post_name"), legacyId));
    const slug = normalizeSlug(getTagText(item, "wp:post_name"), legacyUrl.replace(/^\/|\/$/g, "").split("/").at(-1) || legacyId);
    const body = getTagText(item, "content:encoded");
    const excerpt = getTagText(item, "excerpt:encoded");
    const publishedAt = getTagText(item, "wp:post_date_gmt") || getTagText(item, "wp:post_date") || void 0;
    const oldSlugs = getBlocks(item, "wp:postmeta").filter((meta) => getTagText(meta, "wp:meta_key") === "_wp_old_slug").map((meta) => normalizeSlug(getTagText(meta, "wp:meta_value"), "legacy"));
    const categorySlugs = [];
    const tagSlugs = [];
    for (const category of parseCategoryBlocks(item)) {
      const domain = getAttributeValue(category.attributes, "domain");
      const slugValue = normalizeSlug(getAttributeValue(category.attributes, "nicename"), normalizeSlug(category.value, "term"));
      if (domain === "category") {
        categorySlugs.push(slugValue);
        termsByKey.set(`category:${slugValue}`, {
          kind: "category",
          slug: slugValue,
          name: category.value || slugValue
        });
      } else if (domain === "post_tag") {
        tagSlugs.push(slugValue);
        termsByKey.set(`tag:${slugValue}`, {
          kind: "tag",
          slug: slugValue,
          name: category.value || slugValue
        });
      }
    }
    if (postType === "post" || postType === "page") {
      contentRecords.push({
        id: `${postType}-${legacyId}`,
        legacyId,
        kind: postType,
        slug,
        title,
        body,
        excerpt: excerpt || void 0,
        status: postStatus,
        legacyUrl,
        publishedAt,
        authorLogins: authors.length > 0 ? [authors[0].login] : [],
        categorySlugs,
        tagSlugs,
        oldSlugs
      });
      for (const oldSlug of oldSlugs) {
        const targetPath = legacyUrl;
        const sourcePath = legacyUrl.replace(new RegExp(`${escapeRegExp(slug)}/?$`), `${oldSlug}/`);
        if (sourcePath !== targetPath) {
          redirects.push({
            id: `redirect-${legacyId}-${oldSlug}`,
            sourcePath,
            targetPath,
            reason: "wp_old_slug",
            recordId: `${postType}-${legacyId}`
          });
        }
      }
      for (const [commentIndex, commentBlock] of getBlocks(item, "wp:comment").entries()) {
        comments.push({
          id: `comment-${legacyId}-${commentIndex + 1}`,
          legacyId: getTagText(commentBlock, "wp:comment_id") || `${legacyId}-${commentIndex + 1}`,
          recordId: `${postType}-${legacyId}`,
          authorName: getTagText(commentBlock, "wp:comment_author") || "Anonymous",
          authorEmail: getTagText(commentBlock, "wp:comment_author_email") || void 0,
          body: getTagText(commentBlock, "wp:comment_content"),
          status: getTagText(commentBlock, "wp:comment_approved") === "1" ? "approved" : "pending",
          createdAt: getTagText(commentBlock, "wp:comment_date_gmt") || getTagText(commentBlock, "wp:comment_date") || void 0
        });
      }
      continue;
    }
    if (postType === "attachment") {
      const sourceUrl = getTagText(item, "wp:attachment_url") || getTagText(item, "guid");
      const filename = safeArtifactFilename(filenameFromUrl(sourceUrl, `${slug || legacyId}.bin`), `${slug || legacyId}.bin`);
      mediaAssets.push({
        id: `media-${legacyId}`,
        legacyId,
        slug,
        title,
        sourceUrl,
        legacyUrl,
        filename,
        mimeType: inferMimeType(filename),
        parentLegacyId: getTagText(item, "wp:post_parent") || void 0
      });
      continue;
    }
    skipped += 1;
  }
  const unsupported = detectUnsupportedPatterns(buildUnsupportedSource({
    contentRecords
  }));
  const remediationCandidates = contentRecords.filter((record) => /\[[a-z][^\]]*\]|elementor|vc_row|wp-block-|et_pb_|fusion_/i.test(`${record.body}\n${record.excerpt ?? ""}`)).map((record) => record.id);
  return {
    authors,
    terms: [...termsByKey.values()],
    contentRecords,
    mediaAssets,
    comments,
    redirects,
    entityCounts: {
      posts: contentRecords.filter((record) => record.kind === "post").length,
      pages: contentRecords.filter((record) => record.kind === "page").length,
      attachments: mediaAssets.length,
      redirects: redirects.length,
      comments: comments.length,
      users: authors.length,
      categories: [...termsByKey.values()].filter((term) => term.kind === "category").length,
      tags: [...termsByKey.values()].filter((term) => term.kind === "tag").length,
      skipped
    },
    remediationCandidates,
    unsupportedPatterns: unsupported.unsupportedPatterns,
    warnings: unsupported.warnings
  };
}

function buildInventory(input, bundle) {
  const unsupported = detectUnsupportedPatterns(buildUnsupportedSource(bundle));
  return {
    exportFile: input.exportFile,
    sourceUrl: input.sourceUrl,
    detectedRecords: bundle.contentRecords.length + bundle.mediaAssets.length,
    detectedMedia: bundle.mediaAssets.length,
    detectedComments: bundle.comments.length,
    detectedUsers: bundle.authors.length,
    detectedShortcodes: unsupported.shortcodeMatches,
    detectedBuilderMarkers: unsupported.builderMatches,
    entityCounts: bundle.entityCounts,
    unsupportedPatterns: bundle.unsupportedPatterns,
    remediationCandidates: bundle.remediationCandidates,
    warnings: bundle.warnings
  };
}

function buildImportPlan(inventory, overrides = {
  includeComments: true,
  includeUsers: true,
  includeMedia: true,
  downloadMedia: false,
  applyLocal: false
}) {
  const includeComments = overrides.includeComments ?? inventory.detectedComments > 0;
  const includeUsers = overrides.includeUsers ?? inventory.detectedUsers > 0;
  const includeMedia = overrides.includeMedia ?? inventory.detectedMedia > 0;
  const downloadMedia = includeMedia && (overrides.downloadMedia ?? false);
  const applyLocal = overrides.applyLocal ?? false;
  const manualTasks = [...inventory.warnings];
  if (inventory.remediationCandidates.length > 0) {
    manualTasks.push("Review remediation-candidates.json for shortcode or page-builder cleanup before publishing staged content.");
  }
  if (downloadMedia && !overrides.artifactDir) {
    manualTasks.push("Media download was requested without an artifact directory; downloads will be skipped.");
  }
  return {
    sourceUrl: inventory.sourceUrl,
    exportFile: inventory.exportFile,
    artifactDir: overrides.artifactDir,
    includeComments,
    includeUsers,
    includeMedia,
    downloadMedia: downloadMedia && Boolean(overrides.artifactDir),
    applyLocal,
    permalinkStrategy: "preserve-wordpress-links",
    resumeSupported: true,
    entityCounts: inventory.entityCounts,
    reviewRequired: inventory.unsupportedPatterns.length > 0,
    manualTasks: [...new Set(manualTasks)]
  };
}

async function readDownloadState(downloadStateFile) {
  try {
    return JSON.parse(await readFile(downloadStateFile, "utf8"));
  } catch {
    return {
      completed: [],
      failed: []
    };
  }
}

async function fileExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonArtifact(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function downloadMediaAssets(mediaAssets, artifactDir, resumeFrom) {
  const downloadsDir = path.join(artifactDir, "downloads");
  const downloadStateFile = path.join(artifactDir, "download-state.json");
  await mkdir(downloadsDir, {
    recursive: true
  });
  const state = await readDownloadState(resumeFrom || downloadStateFile);
  const completed = new Set(state.completed);
  const failed = [...state.failed];
  let downloadedMedia = 0;
  for (const asset of mediaAssets) {
    const assetTarget = path.join(downloadsDir, asset.filename);
    if (completed.has(asset.id) && await fileExists(assetTarget)) {
      continue;
    }
    try {
      const response = await fetch(asset.sourceUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(assetTarget, buffer);
      completed.add(asset.id);
      downloadedMedia += 1;
    } catch (error) {
      failed.push({
        id: asset.id,
        sourceUrl: asset.sourceUrl,
        reason: error instanceof Error ? error.message : "Unknown media download error"
      });
    }
  }
  const normalizedState = {
    completed: [...completed].sort(),
    failed: failed.filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id && candidate.reason === entry.reason) === index)
  };
  await writeJsonArtifact(downloadStateFile, normalizedState);
  return {
    downloadStateFile,
    downloadedMedia,
    failedMedia: normalizedState.failed
  };
}

async function parseImportInput(input) {
  if (!input.exportFile) {
    throw new Error("WordPress import requires an `exportFile` path.");
  }
  const source = await readFile(input.exportFile, "utf8");
  const bundle = parseWordPressExport(source);
  const inventory = buildInventory(input, bundle);
  return {
    source,
    bundle,
    inventory
  };
}

async function stageArtifacts(artifactDir, inventory, plan, bundle, resumeFrom) {
  await mkdir(artifactDir, {
    recursive: true
  });
  const artifacts = {
    artifactDir,
    inventoryFile: path.join(artifactDir, "wordpress.inventory.json"),
    planFile: path.join(artifactDir, "wordpress.plan.json"),
    contentFile: path.join(artifactDir, "content-records.json"),
    mediaFile: path.join(artifactDir, "media-manifest.json"),
    commentFile: path.join(artifactDir, "comment-records.json"),
    userFile: path.join(artifactDir, "user-records.json"),
    redirectFile: path.join(artifactDir, "redirect-records.json"),
    taxonomyFile: path.join(artifactDir, "taxonomy-records.json"),
    remediationFile: path.join(artifactDir, "remediation-candidates.json"),
    downloadStateFile: path.join(artifactDir, "download-state.json")
  };
  await writeJsonArtifact(artifacts.inventoryFile, inventory);
  await writeJsonArtifact(artifacts.planFile, plan);
  await writeJsonArtifact(artifacts.contentFile, bundle.contentRecords);
  await writeJsonArtifact(artifacts.mediaFile, bundle.mediaAssets);
  await writeJsonArtifact(artifacts.commentFile, bundle.comments);
  await writeJsonArtifact(artifacts.userFile, bundle.authors);
  await writeJsonArtifact(artifacts.redirectFile, bundle.redirects);
  await writeJsonArtifact(artifacts.taxonomyFile, bundle.terms);
  await writeJsonArtifact(artifacts.remediationFile, bundle.remediationCandidates);
  if (!plan.downloadMedia) {
    await writeJsonArtifact(artifacts.downloadStateFile, {
      completed: [],
      failed: []
    });
    return {
      artifacts,
      downloadedMedia: 0,
      failedMedia: []
    };
  }
  const downloadOutcome = await downloadMediaAssets(bundle.mediaAssets, artifactDir, resumeFrom);
  artifacts.downloadStateFile = downloadOutcome.downloadStateFile;
  return {
    artifacts,
    downloadedMedia: downloadOutcome.downloadedMedia,
    failedMedia: downloadOutcome.failedMedia
  };
}

function resolveLocalAdminDbPath(workspaceRoot, adminDbPath) {
  if (adminDbPath) {
    return path.isAbsolute(adminDbPath) ? adminDbPath : path.join(workspaceRoot, adminDbPath);
  }
  return createDefaultAstropressSqliteSeedToolkit().getDefaultAdminDbPath(workspaceRoot);
}

async function fileSizeOrNull(targetPath) {
  try {
    return (await stat(targetPath)).size;
  } catch {
    return null;
  }
}

async function applyImportToLocalRuntime(input) {
  const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
  const resolvedDbPath = resolveLocalAdminDbPath(input.workspaceRoot, input.adminDbPath);
  seedToolkit.seedDatabase({
    dbPath: resolvedDbPath,
    workspaceRoot: input.workspaceRoot
  });
  const db = seedToolkit.openSeedDatabase(resolvedDbPath);
  const runtime = createAstropressSqliteAdminRuntime({
    getDatabase: () => db
  });
  try {
    db.exec("BEGIN");
    const contentRouteByImportId = new Map();
    const upsertAuthor = db.prepare(`
        INSERT INTO authors (slug, name, bio, deleted_at)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          bio = excluded.bio,
          deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `);
    const selectAuthorId = db.prepare("SELECT id FROM authors WHERE slug = ? LIMIT 1");
    const authorIdsByLogin = new Map();
    if (input.plan.includeUsers) {
      for (const author of input.bundle.authors) {
        upsertAuthor.run(author.login, author.displayName, null);
        const authorRow = selectAuthorId.get(author.login);
        if (authorRow) {
          authorIdsByLogin.set(author.login, authorRow.id);
        }
      }
    }
    const upsertCategory = db.prepare(`
        INSERT INTO categories (slug, name, description, deleted_at)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `);
    const upsertTag = db.prepare(`
        INSERT INTO tags (slug, name, description, deleted_at)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `);
    const selectCategoryId = db.prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1");
    const selectTagId = db.prepare("SELECT id FROM tags WHERE slug = ? LIMIT 1");
    const categoryIdsBySlug = new Map();
    const tagIdsBySlug = new Map();
    for (const term of input.bundle.terms) {
      if (term.kind === "category") {
        upsertCategory.run(term.slug, term.name, null);
        const row = selectCategoryId.get(term.slug);
        if (row) {
          categoryIdsBySlug.set(term.slug, row.id);
        }
      } else {
        upsertTag.run(term.slug, term.name, null);
        const row = selectTagId.get(term.slug);
        if (row) {
          tagIdsBySlug.set(term.slug, row.id);
        }
      }
    }
    for (const record of input.bundle.contentRecords) {
      const existing = runtime.sqliteAdminStore.content.getContentState(record.slug);
      const contentStatus = record.status === "archived" ? "archived" : record.status === "draft" ? "draft" : "published";
      const authorIds = record.authorLogins.map((login) => authorIdsByLogin.get(login)).filter((value) => typeof value === "number");
      const categoryIds = record.categorySlugs.map((slug) => categoryIdsBySlug.get(slug)).filter((value) => typeof value === "number");
      const tagIds = record.tagSlugs.map((slug) => tagIdsBySlug.get(slug)).filter((value) => typeof value === "number");
      if (existing) {
        const result = runtime.sqliteAdminStore.content.saveContentState(record.slug, {
          title: record.title,
          status: contentStatus,
          body: record.body,
          seoTitle: record.title,
          metaDescription: record.excerpt ?? record.title,
          excerpt: record.excerpt,
          authorIds,
          categoryIds,
          tagIds,
          revisionNote: `WordPress import ${record.legacyId}`
        }, WORDPRESS_IMPORT_ACTOR);
        if (!result.ok) {
          throw new Error(result.error);
        }
        db.prepare("UPDATE content_entries SET legacy_url = ?, summary = ?, kind = ? WHERE slug = ?").run(record.legacyUrl, record.excerpt ?? "", record.kind, record.slug);
        contentRouteByImportId.set(record.id, record.legacyUrl);
        contentRouteByImportId.set(record.legacyId, record.legacyUrl);
      } else {
        const created = runtime.sqliteAdminStore.content.createContentRecord({
          title: record.title,
          slug: record.slug,
          legacyUrl: record.legacyUrl,
          body: record.body,
          summary: record.excerpt ?? "",
          status: contentStatus,
          seoTitle: record.title,
          metaDescription: record.excerpt ?? record.title,
          excerpt: record.excerpt
        }, WORDPRESS_IMPORT_ACTOR);
        if (!created.ok) {
          throw new Error(created.error);
        }
        const saved = runtime.sqliteAdminStore.content.saveContentState(record.slug, {
          title: record.title,
          status: contentStatus,
          body: record.body,
          seoTitle: record.title,
          metaDescription: record.excerpt ?? record.title,
          excerpt: record.excerpt,
          authorIds,
          categoryIds,
          tagIds,
          revisionNote: `WordPress import ${record.legacyId}`
        }, WORDPRESS_IMPORT_ACTOR);
        if (!saved.ok) {
          throw new Error(saved.error);
        }
        db.prepare("UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?").run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
        contentRouteByImportId.set(record.id, record.legacyUrl);
        contentRouteByImportId.set(record.legacyId, record.legacyUrl);
      }
    }
    const upsertComment = db.prepare(`
        INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          author = excluded.author,
          email = excluded.email,
          body = excluded.body,
          route = excluded.route,
          status = excluded.status,
          policy = excluded.policy,
          submitted_at = excluded.submitted_at
      `);
    const upsertRedirect = db.prepare(`
        INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(source_path) DO UPDATE SET
          target_path = excluded.target_path,
          status_code = excluded.status_code,
          created_by = excluded.created_by,
          deleted_at = NULL
      `);
    if (input.plan.includeComments) {
      for (const comment of input.bundle.comments) {
        upsertComment.run(comment.id, comment.authorName, comment.authorEmail ?? null, comment.body, contentRouteByImportId.get(comment.recordId) ?? "/", comment.status, "legacy-readonly", comment.createdAt ?? new Date().toISOString());
      }
    }
    const upsertMedia = db.prepare(`
        INSERT INTO media_assets (
          id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_by, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          source_url = excluded.source_url,
          local_path = excluded.local_path,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          alt_text = excluded.alt_text,
          title = excluded.title,
          uploaded_by = excluded.uploaded_by,
          deleted_at = NULL
      `);
    if (input.plan.includeMedia) {
      for (const asset of input.bundle.mediaAssets) {
        const downloadedPath = input.artifactDir ? path.join(input.artifactDir, "downloads", asset.filename) : void 0;
        const hasDownloadedFile = downloadedPath ? await fileExists(downloadedPath) : false;
        const localPath = hasDownloadedFile ? downloadedPath : asset.legacyUrl;
        upsertMedia.run(asset.id, asset.sourceUrl, localPath, asset.mimeType, hasDownloadedFile ? await fileSizeOrNull(downloadedPath) : null, "", asset.title, WORDPRESS_IMPORT_ACTOR.email);
      }
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
      appliedRedirects: input.bundle.redirects.length
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function createAstropressWordPressImportSource(options = {}) {
  return {
    async inspectWordPress(input) {
      const { inventory } = await parseImportInput({
        ...input,
        sourceUrl: input.sourceUrl ?? options.sourceUrl
      });
      return inventory;
    },
    async planWordPressImport(input) {
      return buildImportPlan(input.inventory, {
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true,
        downloadMedia: input.downloadMedia ?? false,
        artifactDir: input.artifactDir,
        applyLocal: input.applyLocal ?? false
      });
    },
    async importWordPress(input) {
      const { bundle, inventory } = await parseImportInput({
        ...input,
        sourceUrl: input.sourceUrl ?? options.sourceUrl
      });
      const plan = input.plan ?? buildImportPlan(inventory, {
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true,
        downloadMedia: input.downloadMedia ?? false,
        artifactDir: input.artifactDir,
        applyLocal: input.applyLocal ?? false
      });
      const artifactsOutcome = plan.artifactDir ? await stageArtifacts(plan.artifactDir, inventory, plan, bundle, input.resumeFrom) : {
        artifacts: void 0,
        downloadedMedia: 0,
        failedMedia: []
      };
      const localApply = plan.applyLocal ? await applyImportToLocalRuntime({
        bundle,
        artifactDir: plan.artifactDir,
        workspaceRoot: input.workspaceRoot ?? process.cwd(),
        adminDbPath: input.adminDbPath,
        plan
      }) : void 0;
      if (plan.applyLocal && plan.artifactDir) {
        const localApplyReportFile = path.join(plan.artifactDir, "wordpress.local-apply.json");
        await writeJsonArtifact(localApplyReportFile, localApply);
        if (artifactsOutcome.artifacts) {
          artifactsOutcome.artifacts.localApplyReportFile = localApplyReportFile;
        }
      }
      return {
        status: plan.reviewRequired || artifactsOutcome.failedMedia.length > 0 ? "completed_with_warnings" : "completed",
        importedRecords: bundle.contentRecords.length,
        importedMedia: plan.includeMedia ? bundle.mediaAssets.length : 0,
        importedComments: plan.includeComments ? bundle.comments.length : 0,
        importedUsers: plan.includeUsers ? bundle.authors.length : 0,
        importedRedirects: bundle.redirects.length,
        downloadedMedia: artifactsOutcome.downloadedMedia,
        failedMedia: artifactsOutcome.failedMedia,
        reviewRequired: plan.reviewRequired,
        manualTasks: plan.manualTasks,
        plan,
        inventory,
        artifacts: artifactsOutcome.artifacts,
        localApply,
        warnings: [...new Set([...inventory.warnings, ...plan.manualTasks, ...(localApply ? [`Applied WordPress import into local SQLite runtime at ${localApply.adminDbPath}.`] : []), ...artifactsOutcome.failedMedia.map((entry) => `Media download failed for ${entry.id}: ${entry.reason}`)])]
      };
    },
    async resumeWordPressImport(input) {
      return this.importWordPress({
        ...input,
        sourceUrl: input.sourceUrl ?? options.sourceUrl,
        artifactDir: input.artifactDir,
        resumeFrom: path.join(input.artifactDir, "download-state.json")
      });
    }
  };
}
