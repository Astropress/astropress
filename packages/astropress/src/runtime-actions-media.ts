import { withLocalStoreFallback } from "./admin-store-dispatch";
import { dispatchPluginMediaEvent, peekCmsConfig } from "./config";
import { recordD1Audit } from "./d1-audit";
import type { Actor } from "./persistence-types";
import {
	buildMediaCreateResult,
	detectImageDimensionsForMime,
	insertMediaAssetRecord,
	processImageVariants,
} from "./runtime-actions-media-helpers";
import {
	deleteRuntimeMediaObject,
	storeRuntimeMediaObject,
} from "./runtime-media-storage";

type MediaAssetInput = {
	filename: string;
	bytes: Uint8Array;
	mimeType: string;
	title?: string;
	altText?: string;
};

function checkUploadSize(
	bytes: Uint8Array,
): { ok: true } | { ok: false; error: string } {
	const maxUploadBytes = peekCmsConfig()?.maxUploadBytes ?? 10 * 1024 * 1024;
	if (bytes.length > maxUploadBytes) {
		const limitMib = (maxUploadBytes / (1024 * 1024)).toFixed(1);
		return {
			ok: false,
			error: `File too large — maximum upload size is ${limitMib} MiB`,
		};
	}
	return { ok: true };
}

export async function updateRuntimeMediaAsset(
	input: {
		id: string;
		title?: string;
		altText?: string;
	},
	actor: Actor,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const id = input.id.trim();
			if (!id) {
				return { ok: false as const, error: "Media asset id is required." };
			}

			const existing = await db
				.prepare(
					"SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1",
				)
				.bind(id)
				.first<{ id: string }>();

			if (!existing) {
				return {
					ok: false as const,
					error: "The selected media asset could not be updated.",
				};
			}

			await db
				.prepare(
					"UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL",
				)
				.bind(input.title?.trim() ?? "", input.altText?.trim() ?? "", id)
				.run();

			await recordD1Audit(
				locals,
				actor,
				"media.update",
				"content",
				id,
				`Updated media metadata for ${id}.`,
			);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.updateMediaAsset(input, actor),
	);
}

export async function createRuntimeMediaAsset(
	input: MediaAssetInput,
	actor: Actor,
	locals?: App.Locals | null,
) {
	const sizeCheck = checkUploadSize(input.bytes);
	if (!sizeCheck.ok) {
		return { ok: false as const, error: sizeCheck.error };
	}

	const imageDimensions = await detectImageDimensionsForMime(
		input.bytes,
		input.mimeType,
	);

	return withLocalStoreFallback(
		locals,
		async (db) => {
			const stored = await storeRuntimeMediaObject(input, locals);
			if (!stored.ok) {
				return stored;
			}

			const { thumbnailUrl, srcset } = await processImageVariants(
				input,
				stored.asset,
				imageDimensions,
				locals,
			);
			await insertMediaAssetRecord(
				db,
				stored.asset,
				actor,
				imageDimensions,
				thumbnailUrl,
				srcset,
			);

			await recordD1Audit(
				locals,
				actor,
				"media.upload",
				"content",
				stored.asset.id,
				`Uploaded media asset ${stored.asset.storedFilename}.`,
			);
			await dispatchPluginMediaEvent({
				id: stored.asset.id,
				filename: input.filename,
				mimeType: stored.asset.mimeType,
				size: stored.asset.fileSize,
				actor: actor.email,
			});
			return buildMediaCreateResult(
				stored.asset.id,
				imageDimensions,
				thumbnailUrl,
				srcset,
			);
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.createMediaAsset(input, actor),
	);
}

export async function deleteRuntimeMediaAsset(
	id: string,
	actor: Actor,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const assetId = id.trim();
			if (!assetId) {
				return { ok: false as const, error: "Media asset id is required." };
			}

			const existing = await db
				.prepare(
					"SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1",
				)
				.bind(assetId)
				.first<{ id: string }>();

			if (!existing) {
				return {
					ok: false as const,
					error: "The selected media asset could not be deleted.",
				};
			}

			await db
				.prepare(
					"UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
				)
				.bind(assetId)
				.run();
			const row = await db
				.prepare(
					"SELECT local_path, r2_key FROM media_assets WHERE id = ? LIMIT 1",
				)
				.bind(assetId)
				.first<{ local_path: string | null; r2_key: string | null }>();
			await deleteRuntimeMediaObject(
				{
					localPath: row?.local_path,
					r2Key: row?.r2_key,
				},
				locals,
			);

			await recordD1Audit(
				locals,
				actor,
				"media.delete",
				"content",
				assetId,
				`Deleted media asset ${assetId}.`,
			);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.deleteMediaAsset(id, actor),
	);
}
