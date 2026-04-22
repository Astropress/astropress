import type { D1AdminReadStore } from "./d1-admin-store";
import type { D1DatabaseLike } from "./d1-database";
import type { MediaAsset } from "./persistence-types";

export function createD1MediaReadPart(
	db: D1DatabaseLike,
): D1AdminReadStore["media"] {
	return {
		async listMediaAssets(): Promise<MediaAsset[]> {
			const rows = (
				await db
					.prepare(
						`
              SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
              FROM media_assets
              WHERE deleted_at IS NULL
              ORDER BY datetime(uploaded_at) DESC, id DESC
            `,
					)
					.all<{
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
					}>()
			).results;

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
		},
	};
}
