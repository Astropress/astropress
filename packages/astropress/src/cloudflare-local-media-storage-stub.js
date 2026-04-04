import { guessImageMimeType } from "./cloudflare-local-image-storage-stub.js";

function unavailable() {
  throw new Error(
    "Local media storage is unavailable in the Cloudflare build. Configure a Cloudflare-safe media storage adapter instead.",
  );
}

export function guessMediaMimeType(pathname) {
  return guessImageMimeType(pathname);
}

export function buildLocalMediaDescriptor() {
  return unavailable();
}

export function createLocalMediaUpload() {
  return unavailable();
}

export function deleteLocalMediaUpload() {
  return unavailable();
}
