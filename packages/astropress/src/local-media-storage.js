import { unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureLocalUploadsDir, getLocalUploadsDir, guessImageMimeType } from "./local-image-storage.js";

const uploadsDir = getLocalUploadsDir();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);

const maxUploadBytes = 10 * 1024 * 1024;

export function guessMediaMimeType(pathname) {
  return guessImageMimeType(pathname);
}

export function buildLocalMediaDescriptor(input) {
  if (!input.filename || input.bytes.byteLength === 0) {
    return { ok: false, error: "Select a file to upload." };
  }

  if (input.bytes.byteLength > maxUploadBytes) {
    return { ok: false, error: "File exceeds the 10 MB size limit." };
  }

  const extension = path.extname(input.filename).toLowerCase() || ".bin";
  if (!allowedExtensions.has(extension)) {
    return { ok: false, error: "File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images." };
  }

  const guessedMime = input.mimeType || guessMediaMimeType(`file${extension}`);
  if (!allowedMimeTypes.has(guessedMime)) {
    return { ok: false, error: "File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images." };
  }

  ensureLocalUploadsDir();

  const baseName =
    path.basename(input.filename, extension).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "upload";
  const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedFilename = `${baseName}-${id}${extension}`;
  const diskPath = path.join(uploadsDir, storedFilename);
  const publicPath = `/images/uploads/${storedFilename}`;

  return {
    ok: true,
    asset: {
      id,
      storedFilename,
      diskPath,
      publicPath,
      r2Key: `uploads/${storedFilename}`,
      mimeType: input.mimeType || guessMediaMimeType(storedFilename),
      fileSize: input.bytes.byteLength,
      title: input.title?.trim() || baseName,
      altText: input.altText?.trim() ?? "",
    },
  };
}

export function createLocalMediaUpload(input) {
  const descriptor = buildLocalMediaDescriptor(input);
  if (!descriptor.ok) {
    return descriptor;
  }

  ensureLocalUploadsDir();
  writeFileSync(descriptor.asset.diskPath, Buffer.from(input.bytes));
  return descriptor;
}

export function deleteLocalMediaUpload(localPath) {
  if (!localPath.startsWith("/images/uploads/")) {
    return;
  }

  const diskPath = path.join(uploadsDir, path.basename(localPath));
  try {
    unlinkSync(diskPath);
  } catch {}
}
