import { createAstropressLocalMediaRepository } from "../local-media-repository-factory.js";
import { createAstropressRateLimitRepository } from "../rate-limit-repository-factory.js";

function createSqliteAssetsStore(getDb, now) {
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

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
        windowMs: row.window_ms,
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
    },
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
      /* v8 ignore next 4 */
      altText: row.alt_text ?? "",
      title: row.title ?? "",
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by ?? "",
    }));
  }

  function updateMediaAsset(input, actor) {
    const id = input.id.trim();
    if (!id) {
      return { ok: false, error: "Media asset id is required." };
    }
    /* v8 ignore next 1 */
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
    },
  });

  return { sqliteRateLimitRepository, sqliteMediaRepository };
}

export { createSqliteAssetsStore };
