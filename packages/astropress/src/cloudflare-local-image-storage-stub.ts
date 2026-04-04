function unavailable(): never {
  throw new Error(
    "Local image storage is unavailable in the Cloudflare build. Configure a Cloudflare-safe image storage adapter instead.",
  );
}

export function getLocalImageRoot(): never {
  return unavailable();
}

export function getLocalUploadsDir(): never {
  return unavailable();
}

export function ensureLocalUploadsDir(): never {
  return unavailable();
}

export function guessImageMimeType(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

export function resolveLocalImageDiskPath(): never {
  return unavailable();
}

export function readLocalImageAsset(): never {
  return unavailable();
}
