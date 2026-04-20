import { createAstropressLocalMediaRepository } from "../local-media-repository-factory";
import type { Actor, SessionUser } from "../persistence-types";
import { createAstropressRateLimitRepository } from "../rate-limit-repository-factory";
import { recordAudit } from "./audit-log";
import type { AstropressSqliteDatabaseLike } from "./utils";

const SQL_READ_RATE_LIMIT =
	"SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1";
const SQL_RESET_RATE_LIMIT =
	"INSERT INTO rate_limits (key, count, window_start_ms, window_ms) VALUES (?, 1, ?, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start_ms = excluded.window_start_ms, window_ms = excluded.window_ms";
const SQL_INC_RATE_LIMIT =
	"UPDATE rate_limits SET count = count + 1 WHERE key = ?";
const SQL_UPDATE_MEDIA =
	"UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL";
const SQL_INSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
const SQL_GET_MEDIA_FOR_DELETE =
	"SELECT local_path FROM media_assets WHERE id = ? AND deleted_at IS NULL";
const SQL_SOFT_DELETE_MEDIA =
	"UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?";

export function createSqliteAssetsStore(
	getDb: () => AstropressSqliteDatabaseLike,
	now: () => number,
) {
	const sqliteRateLimitRepository = createAstropressRateLimitRepository({
		now,
		readRateLimitWindow(key: string) {
			const row = getDb().prepare(SQL_READ_RATE_LIMIT).get(key) as
				| { count: number; window_start_ms: number; window_ms: number }
				| undefined;
			if (!row) return null;
			return {
				count: row.count,
				windowStartMs: row.window_start_ms,
				windowMs: row.window_ms,
			};
		},
		resetRateLimitWindow(key: string, currentTime: number, windowMs: number) {
			getDb().prepare(SQL_RESET_RATE_LIMIT).run(key, currentTime, windowMs);
		},
		incrementRateLimitWindow(key: string) {
			getDb().prepare(SQL_INC_RATE_LIMIT).run(key);
		},
	});

	function listMediaAssets() {
		const rows = getDb()
			.prepare(
				`
          SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
          FROM media_assets
          WHERE deleted_at IS NULL
          ORDER BY datetime(uploaded_at) DESC, id DESC
        `,
			)
			.all() as Array<{
			id: string;
			source_url: string | null;
			local_path: string;
			r2_key: string | null;
			mime_type: string | null;
			width: number | null;
			height: number | null;
			file_size: number | null;
			alt_text: string | null;
			title: string | null;
			uploaded_at: string;
			uploaded_by: string | null;
		}>;

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
			uploadedBy: row.uploaded_by ?? "",
		}));
	}

	function updateMediaAsset(
		input: {
			id: string;
			title?: string;
			altText?: string;
		},
		actor: Actor,
	) {
		const id = input.id.trim();
		if (!id) {
			return { ok: false as const, error: "Media asset id is required." };
		}

		const result = getDb()
			.prepare(SQL_UPDATE_MEDIA)
			.run(input.title?.trim() ?? "", input.altText?.trim() ?? "", id);

		if (result.changes === 0) {
			return {
				ok: false as const,
				error: "The selected media asset could not be updated.",
			};
		}

		recordAudit(
			getDb(),
			actor,
			"media.update",
			`Updated media metadata for ${id}.`,
			"content",
			id,
		);
		return { ok: true as const };
	}

	const sqliteMediaRepository = createAstropressLocalMediaRepository({
		listMediaAssets,
		updateMediaAsset,
		insertStoredMediaAsset({
			asset,
			actor,
		}: {
			asset: {
				id: string;
				publicPath: string;
				r2Key: string | null;
				mimeType: string | null;
				fileSize: number | null;
				altText: string;
				title: string;
				storedFilename?: string;
			};
			actor: Actor;
		}) {
			getDb()
				.prepare(SQL_INSERT_MEDIA)
				.run(
					asset.id,
					null,
					asset.publicPath,
					asset.r2Key,
					asset.mimeType,
					asset.fileSize,
					asset.altText,
					asset.title,
					actor.email,
				);
		},
		getStoredMediaDeletionCandidate(id: string) {
			const row = getDb().prepare(SQL_GET_MEDIA_FOR_DELETE).get(id) as
				| { local_path: string }
				| undefined;
			return row ? { localPath: row.local_path } : null;
		},
		markStoredMediaDeleted(id: string) {
			return getDb().prepare(SQL_SOFT_DELETE_MEDIA).run(id).changes > 0;
		},
		recordMediaAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "content", targetId);
		},
	});

	return { sqliteRateLimitRepository, sqliteMediaRepository };
}
