import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const defaultImageRoot = path.resolve(workspaceRoot, "..", "new-site-images");

export function getLocalImageRoot() {
  return process.env.LOCAL_IMAGE_ROOT?.trim() || defaultImageRoot;
}

export function getLocalUploadsDir() {
  return path.join(getLocalImageRoot(), "uploads");
}

export function ensureLocalUploadsDir() {
  mkdirSync(getLocalUploadsDir(), { recursive: true });
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

export function resolveLocalImageDiskPath(publicPath: string) {
  if (!publicPath.startsWith("/images/")) {
    throw new Error(`Expected image path under /images/: ${publicPath}`);
  }

  const relativePath = publicPath.slice("/images/".length);
  return path.join(getLocalImageRoot(), relativePath);
}

export function readLocalImageAsset(publicPath: string) {
  const diskPath = resolveLocalImageDiskPath(publicPath);
  if (!existsSync(diskPath)) {
    return { ok: false as const, error: "Image not found." };
  }

  return {
    ok: true as const,
    asset: {
      diskPath,
      bytes: readFileSync(diskPath),
      mimeType: guessImageMimeType(diskPath),
    },
  };
}
