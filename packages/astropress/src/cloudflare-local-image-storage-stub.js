function unavailable() {
  throw new Error(
    "Local image storage is unavailable in the Cloudflare build. Configure a Cloudflare-safe image storage adapter instead.",
  );
}

export function getLocalImageRoot() {
  return unavailable();
}

export function getLocalUploadsDir() {
  return unavailable();
}

export function ensureLocalUploadsDir() {
  return unavailable();
}

export function guessImageMimeType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

export function resolveLocalImageDiskPath() {
  return unavailable();
}

export function readLocalImageAsset() {
  return unavailable();
}
