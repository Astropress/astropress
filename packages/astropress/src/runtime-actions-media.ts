import { withLocalStoreFallback } from "./admin-store-dispatch";
import { dispatchPluginMediaEvent, peekCmsConfig } from "./config";
import { recordD1Audit } from "./d1-audit";
import type { Actor } from "./persistence-types";
import {
	deleteRuntimeMediaObject,
	storeRuntimeMediaObject,
} from "./runtime-media-storage";

/**
 * Detect pixel dimensions of an image buffer using the `image-size` package
 * (no native deps — pure JavaScript, works in CF Workers). Returns null when
 * the format is not recognised or the package is unavailable.
 */
async function detectImageDimensions(
	bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
	try {
		const { imageSize } = await import("image-size");
		// image-size accepts Buffer / Uint8Array
		const result = imageSize(Buffer.from(bytes));
		if (result.width && result.height) {
			return { width: result.width, height: result.height };
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Generate a 400px-wide WebP thumbnail using Sharp when it is available
 * (Sharp has native bindings so it fails silently in CF Workers or test envs).
 * Returns null when Sharp is unavailable or the image is already ≤400px wide.
 */
async function generateThumbnail(
	bytes: Uint8Array,
	width: number,
): Promise<Uint8Array | null> {
	try {
		const sharp = (await import("sharp")).default;
		const output = await sharp(Buffer.from(bytes))
			.resize({ width: 400 })
			.webp()
			.toBuffer();
		return new Uint8Array(output);
	} catch {
		return null;
	}
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

function isResponsiveImageFormat(mimeType: string): boolean {
	return mimeType.startsWith("image/") && !mimeType.includes("svg");
}

async function generateAndStoreThumbnail(
	input: {
		filename: string;
		bytes: Uint8Array;
		mimeType: string;
		title?: string;
		altText?: string;
	},
	storedFilename: string,
	width: number,
	locals?: App.Locals | null,
): Promise<string | null> {
	if (width <= 400) return null;
	const thumbBytes = await generateThumbnail(input.bytes, width);
	if (!thumbBytes) return null;
	const basename = storedFilename.replace(/\.[^.]+$/, "");
	const thumbFilename = `${basename}-thumb.webp`;
	const thumbStored = await storeRuntimeMediaObject(
		{
			...input,
			filename: thumbFilename,
			bytes: thumbBytes,
			mimeType: "image/webp",
		},
		locals,
	);
	return thumbStored.ok ? thumbStored.asset.publicPath : null;
}

async function generateAndStoreSrcset(
	input: {
		filename: string;
		bytes: Uint8Array;
		mimeType: string;
		title?: string;
		altText?: string;
	},
	publicPath: string,
	locals?: App.Locals | null,
): Promise<string | null> {
	const { generateSrcset } = await import("./local-image-storage.js");
	return generateSrcset(
		input.bytes,
		publicPath,
		async (variantFilename, variantBytes) => {
			const variantStored = await storeRuntimeMediaObject(
				{
					...input,
					filename: variantFilename,
					bytes: variantBytes,
					mimeType: "image/webp",
				},
				locals,
			);
			return variantStored.ok ? variantStored.asset.publicPath : null;
		},
	);
}

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

async function processImageVariants(
	input: {
		filename: string;
		bytes: Uint8Array;
		mimeType: string;
		title?: string;
		altText?: string;
	},
	stored: { storedFilename: string; publicPath: string },
	imageDimensions: { width: number; height: number } | null,
	locals?: App.Locals | null,
): Promise<{ thumbnailUrl: string | null; srcset: string | null }> {
	let thumbnailUrl: string | null = null;
	let srcset: string | null = null;
	if (imageDimensions) {
		thumbnailUrl = await generateAndStoreThumbnail(
			input,
			stored.storedFilename,
			imageDimensions.width,
			locals,
		);
	}
	if (imageDimensions && isResponsiveImageFormat(input.mimeType)) {
		srcset = await generateAndStoreSrcset(input, stored.publicPath, locals);
	}
	return { thumbnailUrl, srcset };
}

function buildMediaInsertParams(
	stored: {
		id: string;
		publicPath: string;
		r2Key: string;
		mimeType: string;
		fileSize: number;
		altText: string;
		title: string;
	},
	actor: Actor,
	imageDimensions: { width: number; height: number } | null,
	thumbnailUrl: string | null,
	srcset: string | null,
) {
	return [
		stored.id,
		null,
		stored.publicPath,
		stored.r2Key,
		stored.mimeType,
		stored.fileSize,
		stored.altText,
		stored.title,
		actor.email,
		imageDimensions ? imageDimensions.width : null,
		imageDimensions ? imageDimensions.height : null,
		thumbnailUrl,
		srcset,
	];
}

function buildMediaCreateResult(
	storedId: string,
	imageDimensions: { width: number; height: number } | null,
	thumbnailUrl: string | null,
	srcset: string | null,
) {
	return {
		ok: true as const,
		id: storedId,
		width: imageDimensions ? imageDimensions.width : undefined,
		height: imageDimensions ? imageDimensions.height : undefined,
		thumbnailUrl: thumbnailUrl ?? undefined,
		srcset: srcset ?? undefined,
	};
}

type MediaAssetInput = {
	filename: string;
	bytes: Uint8Array;
	mimeType: string;
	title?: string;
	altText?: string;
};

async function insertMediaAssetRecord(
	db: {
		prepare: (sql: string) => {
			bind: (...args: unknown[]) => { run: () => Promise<unknown> };
		};
	},
	stored: {
		id: string;
		publicPath: string;
		r2Key: string;
		mimeType: string;
		fileSize: number;
		altText: string;
		title: string;
	},
	actor: Actor,
	imageDimensions: { width: number; height: number } | null,
	thumbnailUrl: string | null,
	srcset: string | null,
): Promise<void> {
	await db
		.prepare(
			`
        INSERT INTO media_assets (
          id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by,
          width, height, thumbnail_url, srcset
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
		)
		.bind(
			...buildMediaInsertParams(
				stored,
				actor,
				imageDimensions,
				thumbnailUrl,
				srcset,
			),
		)
		.run();
}

async function detectImageDimensionsForMime(
	bytes: Uint8Array,
	mimeType: string,
) {
	if (mimeType.startsWith("image/")) {
		return detectImageDimensions(bytes);
	}
	return null;
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
