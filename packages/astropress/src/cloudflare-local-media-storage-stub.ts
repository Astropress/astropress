import { guessImageMimeType } from "./cloudflare-local-image-storage-stub";

function unavailable(): never {
	throw new Error(
		"Local media storage is unavailable in the Cloudflare build. Configure a Cloudflare-safe media storage adapter instead.",
	);
}

export function guessMediaMimeType(pathname: string) {
	return guessImageMimeType(pathname);
}

export function buildLocalMediaDescriptor(): never {
	return unavailable();
}

export function createLocalMediaUpload(): never {
	return unavailable();
}

export function deleteLocalMediaUpload(): never {
	return unavailable();
}
