import type { Actor } from "./persistence-types";
import { storeRuntimeMediaObject } from "./runtime-media-storage";

/**
 * Detect pixel dimensions of an image buffer using the `image-size` package
 * (no native deps — pure JavaScript, works in CF Workers). Returns null when
 * the format is not recognised or the package is unavailable.
 */
export async function detectImageDimensions(
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
export async function generateThumbnail(
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

export function isResponsiveImageFormat(mimeType: string): boolean {
	return mimeType.startsWith("image/") && !mimeType.includes("svg");
}

export async function generateAndStoreThumbnail(
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
	// codeql[js/polynomial-redos] [^.]+ is a negated class — cannot overlap with ., so no backtracking
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

export async function generateAndStoreSrcset(
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

export function buildMediaInsertParams(
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

export function buildMediaCreateResult(
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

export async function processImageVariants(
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

export async function insertMediaAssetRecord(
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

export async function detectImageDimensionsForMime(
	bytes: Uint8Array,
	mimeType: string,
) {
	if (mimeType.startsWith("image/")) {
		return detectImageDimensions(bytes);
	}
	return null;
}
