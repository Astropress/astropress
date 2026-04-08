import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultAstropressSqliteSeedToolkit } from "../sqlite-bootstrap.js";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime.js";

const WIX_IMPORT_ACTOR = {
  email: "wix-import@astropress.local",
  role: "admin",
  name: "Wix Import",
};

// ---------------------------------------------------------------------------
// CSV parser (RFC 4180 with quoted field support)
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          value += line[i++];
        }
      }
      fields.push(value);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

function splitCsvRows(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && (ch === "\n" || (ch === "\r" && text[i + 1] === "\n"))) {
      if (ch === "\r") i++;
      if (current.trim()) rows.push(parseCsvLine(current));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(parseCsvLine(current));
  return rows;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

function lastPathSegment(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? slugify(url);
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? slugify(url);
  }
}

function normalizeWixImageUrl(url) {
  if (!url) return url;
  const qIdx = url.indexOf("?");
  const base = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const v1Idx = base.indexOf("/v1/");
  if (v1Idx >= 0) return base.slice(0, v1Idx);
  return base;
}

function scrapeImageUrls(html) {
  const urls = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function cleanWixHtml(html) {
  let cleaned = html.replace(/(<(?:p|div|figure|section|article|h[1-6]|blockquote|li|ul|ol)[^>]*)\sstyle="[^"]*"/gi, "$1");
  cleaned = cleaned.replace(/\sdata-[a-z][a-z0-9-]*="[^"]*"/gi, "");
  cleaned = cleaned.replace(/(src=["'])(https?:\/\/(?:static\.)?wixstatic\.com\/[^"']+)(["'])/gi, (_, pre, url, post) => {
    return pre + normalizeWixImageUrl(url) + post;
  });
  return cleaned;
}

function guessExtension(url) {
  const name = lastPathSegment(url);
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx >= 0) return name.slice(dotIdx);
  return ".jpg";
}

function guessMimeType(url) {
  const ext = guessExtension(url).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

function splitTermList(value) {
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// CSV → ParsedBundle
// ---------------------------------------------------------------------------

export function parseWixExport(csvText) {
  const rows = splitCsvRows(csvText);
  if (rows.length < 2) {
    return { authors: [], terms: [], contentRecords: [], mediaAssets: [], warnings: ["No rows found in Wix CSV export."] };
  }

  const headerRow = rows[0];
  const headerIndex = new Map();
  headerRow.forEach((col, i) => headerIndex.set(col.toLowerCase().trim(), i));

  function col(row, names) {
    for (const name of names) {
      const idx = headerIndex.get(name);
      if (idx !== undefined && row[idx] !== undefined) return row[idx].trim();
    }
    return "";
  }

  const authorSet = new Map();
  const categorySet = new Map();
  const tagSet = new Map();
  const mediaSet = new Map();
  const contentRecords = [];
  const warnings = [];
  let mediaIndex = 0;

  for (const row of rows.slice(1)) {
    const title = col(row, ["title"]);
    const body = col(row, ["body", "content", "richtext", "html"]);
    const isDraft = col(row, ["isdraft", "draft"]).toLowerCase() === "true";
    const status = isDraft ? "draft" : "published";
    const authorName = col(row, ["author", "writer"]) || "Unknown";
    const authorLogin = slugify(authorName);
    const rawSlug = col(row, ["slug", "url", "posturl", "link"]);
    const slug = rawSlug ? (lastPathSegment(rawSlug) || slugify(title)) : slugify(title);
    const legacyUrl = rawSlug || `/${slug}`;
    const publishedAt = col(row, ["publisheddate", "publicationdate", "published", "date"]) || undefined;
    const excerpt = col(row, ["excerpt", "description", "summary"]) || undefined;
    const coverImageRaw = col(row, ["coverimage", "featuredimage", "image", "thumbnail"]);

    if (!title && !body) continue;

    if (!authorSet.has(authorLogin)) {
      authorSet.set(authorLogin, { login: authorLogin, displayName: authorName });
    }

    const categorySlugs = [];
    for (const cat of splitTermList(col(row, ["categories", "category"]))) {
      const catSlug = slugify(cat);
      categorySlugs.push(catSlug);
      if (!categorySet.has(catSlug)) {
        categorySet.set(catSlug, { kind: "category", slug: catSlug, name: cat });
      }
    }

    const tagSlugs = [];
    for (const tag of splitTermList(col(row, ["tags", "tag"]))) {
      const tagSlug = slugify(tag);
      tagSlugs.push(tagSlug);
      if (!tagSet.has(tagSlug)) {
        tagSet.set(tagSlug, { kind: "tag", slug: tagSlug, name: tag });
      }
    }

    if (coverImageRaw) {
      const normalized = normalizeWixImageUrl(coverImageRaw);
      if (!mediaSet.has(normalized)) {
        const id = `wix-media-${mediaIndex++}`;
        mediaSet.set(normalized, {
          id,
          slug: id,
          title: title || id,
          sourceUrl: normalized,
          filename: `${id}${guessExtension(normalized)}`,
          mimeType: guessMimeType(normalized),
        });
      }
    }

    for (const imgUrl of scrapeImageUrls(body)) {
      const normalized = normalizeWixImageUrl(imgUrl);
      if (!mediaSet.has(normalized)) {
        const id = `wix-media-${mediaIndex++}`;
        mediaSet.set(normalized, {
          id,
          slug: id,
          title: id,
          sourceUrl: normalized,
          filename: `${id}${guessExtension(normalized)}`,
          mimeType: guessMimeType(normalized),
        });
      }
    }

    contentRecords.push({
      id: `wix-post-${contentRecords.length}`,
      kind: "post",
      slug,
      title,
      body: cleanWixHtml(body),
      excerpt,
      status,
      legacyUrl,
      publishedAt,
      authorLogins: [authorLogin],
      categorySlugs,
      tagSlugs,
    });
  }

  if (contentRecords.length === 0) {
    warnings.push("No blog posts were found in the Wix CSV export. Only blog post exports are supported (Wix pages cannot be exported).");
  }

  return {
    authors: Array.from(authorSet.values()),
    terms: [...Array.from(categorySet.values()), ...Array.from(tagSet.values())],
    contentRecords,
    mediaAssets: Array.from(mediaSet.values()),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Media download
// ---------------------------------------------------------------------------

async function loadDownloadState(stateFile) {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return { completed: [], failed: [] };
  }
}

async function downloadWixMedia(assets, artifactDir, resumeFrom) {
  const downloadsDir = path.join(artifactDir, "downloads");
  await mkdir(downloadsDir, { recursive: true });
  const stateFile = resumeFrom ?? path.join(artifactDir, "download-state.json");
  const state = await loadDownloadState(stateFile);
  const completedSet = new Set(state.completed);
  let downloadedMedia = state.completed.length;

  for (const asset of assets) {
    if (completedSet.has(asset.id)) continue;
    const targetPath = path.join(downloadsDir, asset.filename);
    try {
      const response = await fetch(asset.sourceUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(targetPath, buffer);
      state.completed.push(asset.id);
      downloadedMedia++;
    } catch (err) {
      state.failed.push({
        id: asset.id,
        sourceUrl: asset.sourceUrl,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    await writeFile(stateFile, JSON.stringify(state, null, 2));
  }

  return { downloadedMedia, failedMedia: state.failed, downloadStateFile: stateFile };
}

// ---------------------------------------------------------------------------
// Artifact staging
// ---------------------------------------------------------------------------

async function stageWixArtifacts(artifactDir, bundle) {
  await mkdir(artifactDir, { recursive: true });
  const files = {
    contentFile: path.join(artifactDir, "content-records.json"),
    mediaFile: path.join(artifactDir, "media-manifest.json"),
    userFile: path.join(artifactDir, "user-records.json"),
    taxonomyFile: path.join(artifactDir, "taxonomy-records.json"),
    downloadStateFile: path.join(artifactDir, "download-state.json"),
  };
  await writeFile(files.contentFile, JSON.stringify(bundle.contentRecords, null, 2));
  await writeFile(files.mediaFile, JSON.stringify(bundle.mediaAssets, null, 2));
  await writeFile(files.userFile, JSON.stringify(bundle.authors, null, 2));
  await writeFile(files.taxonomyFile, JSON.stringify(bundle.terms, null, 2));
  return files;
}

// ---------------------------------------------------------------------------
// Local SQLite apply
// ---------------------------------------------------------------------------

async function fileSizeOrNull(targetPath) {
  try {
    const details = await stat(targetPath);
    return details.size;
  } catch {
    return null;
  }
}

function resolveAdminDbPath(workspaceRoot, adminDbPath) {
  if (adminDbPath) {
    return path.isAbsolute(adminDbPath) ? adminDbPath : path.join(workspaceRoot, adminDbPath);
  }
  return createDefaultAstropressSqliteSeedToolkit().getDefaultAdminDbPath(workspaceRoot);
}

async function applyWixImportToLocalRuntime(input) {
  const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
  const resolvedDbPath = resolveAdminDbPath(input.workspaceRoot, input.adminDbPath);
  seedToolkit.seedDatabase({ dbPath: resolvedDbPath, workspaceRoot: input.workspaceRoot });

  const db = seedToolkit.openSeedDatabase(resolvedDbPath);
  const runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => db });

  try {
    db.exec("BEGIN");

    const upsertAuthor = db.prepare(`
      INSERT INTO authors (slug, name, bio, deleted_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name, bio = excluded.bio, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    `);
    const selectAuthorId = db.prepare("SELECT id FROM authors WHERE slug = ? LIMIT 1");
    const authorIdsByLogin = new Map();
    for (const author of input.bundle.authors) {
      upsertAuthor.run(author.login, author.displayName, null);
      const row = selectAuthorId.get(author.login);
      if (row) authorIdsByLogin.set(author.login, row.id);
    }

    const upsertCategory = db.prepare(`
      INSERT INTO categories (slug, name, description, deleted_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    `);
    const upsertTag = db.prepare(`
      INSERT INTO tags (slug, name, description, deleted_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    `);
    const selectCategoryId = db.prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1");
    const selectTagId = db.prepare("SELECT id FROM tags WHERE slug = ? LIMIT 1");
    const categoryIdsBySlug = new Map();
    const tagIdsBySlug = new Map();
    for (const term of input.bundle.terms) {
      if (term.kind === "category") {
        upsertCategory.run(term.slug, term.name, null);
        const row = selectCategoryId.get(term.slug);
        if (row) categoryIdsBySlug.set(term.slug, row.id);
      } else {
        upsertTag.run(term.slug, term.name, null);
        const row = selectTagId.get(term.slug);
        if (row) tagIdsBySlug.set(term.slug, row.id);
      }
    }

    for (const record of input.bundle.contentRecords) {
      const authorIds = record.authorLogins.map((l) => authorIdsByLogin.get(l)).filter((v) => typeof v === "number");
      const categoryIds = record.categorySlugs.map((s) => categoryIdsBySlug.get(s)).filter((v) => typeof v === "number");
      const tagIds = record.tagSlugs.map((s) => tagIdsBySlug.get(s)).filter((v) => typeof v === "number");

      const existing = runtime.sqliteAdminStore.content.getContentState(record.slug);
      if (existing) {
        const saved = runtime.sqliteAdminStore.content.saveContentState(
          record.slug,
          { title: record.title, status: record.status, body: record.body, seoTitle: record.title, metaDescription: record.excerpt ?? record.title, excerpt: record.excerpt, authorIds, categoryIds, tagIds, revisionNote: `Wix import ${record.id}` },
          WIX_IMPORT_ACTOR,
        );
        if (!saved.ok) throw new Error(saved.error);
        db.prepare("UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?")
          .run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
      } else {
        const created = runtime.sqliteAdminStore.content.createContentRecord(
          { title: record.title, slug: record.slug, legacyUrl: record.legacyUrl, body: record.body, summary: record.excerpt ?? "", status: record.status, seoTitle: record.title, metaDescription: record.excerpt ?? record.title, excerpt: record.excerpt },
          WIX_IMPORT_ACTOR,
        );
        if (!created.ok) throw new Error(created.error);
        const saved = runtime.sqliteAdminStore.content.saveContentState(
          record.slug,
          { title: record.title, status: record.status, body: record.body, seoTitle: record.title, metaDescription: record.excerpt ?? record.title, excerpt: record.excerpt, authorIds, categoryIds, tagIds, revisionNote: `Wix import ${record.id}` },
          WIX_IMPORT_ACTOR,
        );
        if (!saved.ok) throw new Error(saved.error);
        db.prepare("UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?")
          .run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
      }
    }

    const upsertMedia = db.prepare(`
      INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_by, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type,
        file_size = excluded.file_size, title = excluded.title, uploaded_by = excluded.uploaded_by, deleted_at = NULL
    `);
    for (const asset of input.bundle.mediaAssets) {
      const downloadedPath = input.artifactDir ? path.join(input.artifactDir, "downloads", asset.filename) : undefined;
      const hasFile = downloadedPath ? (await fileSizeOrNull(downloadedPath)) !== null : false;
      upsertMedia.run(asset.id, asset.sourceUrl, hasFile ? downloadedPath : asset.sourceUrl, asset.mimeType, hasFile ? await fileSizeOrNull(downloadedPath) : null, "", asset.title, WIX_IMPORT_ACTOR.email);
    }

    db.exec("COMMIT");
    return {
      appliedRecords: input.bundle.contentRecords.length,
      appliedMedia: input.bundle.mediaAssets.length,
      appliedAuthors: input.bundle.authors.length,
      adminDbPath: resolvedDbPath,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createAstropressWixImportSource() {
  return {
    async importWix(input) {
      const csvText = await readFile(input.exportFile, "utf8");
      const bundle = parseWixExport(csvText);

      let artifacts = undefined;
      if (input.artifactDir) {
        artifacts = await stageWixArtifacts(input.artifactDir, bundle);
      }

      let downloadedMedia = 0;
      const failedMedia = [];
      if (input.downloadMedia && input.artifactDir && bundle.mediaAssets.length > 0) {
        const dl = await downloadWixMedia(bundle.mediaAssets, input.artifactDir, input.resumeFrom);
        downloadedMedia = dl.downloadedMedia;
        failedMedia.push(...dl.failedMedia);
      }

      let localApply = undefined;
      if (input.applyLocal && input.workspaceRoot) {
        localApply = await applyWixImportToLocalRuntime({
          bundle,
          artifactDir: input.artifactDir,
          workspaceRoot: input.workspaceRoot,
          adminDbPath: input.adminDbPath,
        });
      }

      return {
        status: failedMedia.length > 0 ? "partial" : "complete",
        imported_records: bundle.contentRecords.length,
        imported_media: bundle.mediaAssets.length,
        imported_authors: bundle.authors.length,
        downloaded_media: downloadedMedia,
        failed_media: failedMedia,
        warnings: bundle.warnings,
        artifacts: artifacts
          ? {
              artifact_dir: input.artifactDir ?? null,
              content_file: artifacts.contentFile,
              media_file: artifacts.mediaFile,
              user_file: artifacts.userFile,
              taxonomy_file: artifacts.taxonomyFile,
              download_state_file: artifacts.downloadStateFile,
            }
          : null,
        local_apply: localApply
          ? {
              applied_records: localApply.appliedRecords,
              applied_media: localApply.appliedMedia,
              applied_authors: localApply.appliedAuthors,
              admin_db_path: localApply.adminDbPath,
            }
          : null,
      };
    },
  };
}
