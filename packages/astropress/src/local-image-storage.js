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

export function guessImageMimeType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

export function resolveLocalImageDiskPath(publicPath) {
  if (!publicPath.startsWith("/images/")) {
    throw new Error(`Expected image path under /images/: ${publicPath}`);
  }

  const relativePath = publicPath.slice("/images/".length);
  return path.join(getLocalImageRoot(), relativePath);
}

export function readLocalImageAsset(publicPath) {
  const diskPath = resolveLocalImageDiskPath(publicPath);
  if (!existsSync(diskPath)) {
    return { ok: false, error: "Image not found." };
  }

  const bytes = readFileSync(diskPath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  return {
    ok: true,
    asset: {
      diskPath,
      bytes: arrayBuffer,
      mimeType: guessImageMimeType(diskPath),
    },
  };
}
