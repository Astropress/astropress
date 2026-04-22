import { loadLocalMediaStorage } from "./local-runtime-modules";
import { getCloudflareBindings } from "./runtime-env";

interface MediaUploadInput {
	filename: string;
	bytes: Uint8Array;
	mimeType?: string;
	title?: string;
	altText?: string;
}

interface StoredMediaAsset {
	id: string;
	storedFilename: string;
	publicPath: string;
	r2Key: string;
	mimeType: string;
	fileSize: number;
	title: string;
	altText: string;
}

export async function storeRuntimeMediaObject(
	input: MediaUploadInput,
	locals?: App.Locals | null,
) {
	const bindings = getCloudflareBindings(locals);

	if (bindings.MEDIA_BUCKET) {
		const localMediaStorage = await loadLocalMediaStorage();
		const descriptor = localMediaStorage.buildLocalMediaDescriptor(input);
		if (!descriptor.ok) {
			return descriptor;
		}

		await bindings.MEDIA_BUCKET.put(descriptor.asset.r2Key, input.bytes, {
			httpMetadata: {
				contentType: descriptor.asset.mimeType,
			},
		});

		return {
			ok: true as const,
			asset: descriptor.asset satisfies StoredMediaAsset,
			storage: "r2" as const,
		};
	}

	const localMediaStorage = await loadLocalMediaStorage();
	const stored = localMediaStorage.createLocalMediaUpload(input);
	if (!stored.ok) {
		return stored;
	}

	return {
		ok: true as const,
		asset: stored.asset satisfies StoredMediaAsset,
		storage: "local" as const,
	};
}

export async function deleteRuntimeMediaObject(
	input: {
		localPath?: string | null;
		r2Key?: string | null;
	},
	locals?: App.Locals | null,
) {
	const bindings = getCloudflareBindings(locals);

	if (bindings.MEDIA_BUCKET && input.r2Key) {
		await bindings.MEDIA_BUCKET.delete(input.r2Key);
		return;
	}

	if (input.localPath) {
		const localMediaStorage = await loadLocalMediaStorage();
		localMediaStorage.deleteLocalMediaUpload(input.localPath);
	}
}
