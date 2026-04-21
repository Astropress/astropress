import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	ensureLocalUploadsDir,
	getLocalUploadsDir,
	guessImageMimeType,
} from "./local-image-storage";

const uploadsDir = getLocalUploadsDir();

const allowedMimeTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
	"image/svg+xml",
]);

// Safe file extensions that map unambiguously to allowed image types.
// This allowlist is checked in addition to MIME type — extensions like .php
// that fall through to a default MIME type guess are explicitly blocked here.
const allowedExtensions = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".gif",
	".avif",
	".svg",
]);

const maxUploadBytes = 10 * 1024 * 1024; // 10 MB

export interface LocalMediaDescriptor {
	id: string;
	storedFilename: string;
	diskPath: string;
	publicPath: string;
	r2Key: string;
	mimeType: string;
	fileSize: number;
	title: string;
	altText: string;
}

export function guessMediaMimeType(pathname: string) {
	return guessImageMimeType(pathname);
}

export function buildLocalMediaDescriptor(input: {
	filename: string;
	bytes: Uint8Array;
	mimeType?: string;
	title?: string;
	altText?: string;
	_id?: string;
}) {
	if (!input.filename || input.bytes.byteLength === 0) {
		return { ok: false as const, error: "Select a file to upload." };
	}

	if (input.bytes.byteLength > maxUploadBytes) {
		return { ok: false as const, error: "File exceeds the 10 MB size limit." };
	}

	const extension = path.extname(input.filename).toLowerCase() || ".bin";
	if (!allowedExtensions.has(extension)) {
		return {
			ok: false as const,
			error:
				"File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images.",
		};
	}

	const guessedMime = input.mimeType || guessMediaMimeType(`file${extension}`);
	if (!allowedMimeTypes.has(guessedMime)) {
		return {
			ok: false as const,
			error:
				"File type is not allowed. Upload JPEG, PNG, WebP, GIF, AVIF, or SVG images.",
		};
	}

	ensureLocalUploadsDir();

	const baseName =
		path
			.basename(input.filename, extension)
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase() || "upload";
	const id = input._id ?? `media-${randomUUID()}`;
	const storedFilename = id;
	const diskPath = path.join(uploadsDir, storedFilename);
	const publicPath = `/images/uploads/${storedFilename}`;

	return {
		ok: true as const,
		asset: {
			id,
			storedFilename,
			diskPath,
			publicPath,
			r2Key: `uploads/${storedFilename}`,
			mimeType: guessedMime,
			fileSize: input.bytes.byteLength,
			title: input.title?.trim() || baseName,
			altText: input.altText?.trim() ?? "",
		},
	};
}

export function createLocalMediaUpload(input: {
	filename: string;
	bytes: Uint8Array;
	mimeType?: string;
	title?: string;
	altText?: string;
}) {
	// Generate id here so writePath never flows through a function that takes user input
	const id = `media-${randomUUID()}`;
	const descriptor = buildLocalMediaDescriptor({ ...input, _id: id });
	if (!descriptor.ok) {
		return descriptor;
	}

	ensureLocalUploadsDir();
	const writePath = path.join(uploadsDir, id);
	// audit-ok: writePath derives only from randomUUID (id), generated before any user-input processing
	writeFileSync(writePath, Buffer.from(input.bytes));
	return descriptor;
}

export function deleteLocalMediaUpload(localPath: string) {
	if (!localPath.startsWith("/images/uploads/")) {
		return;
	}

	const diskPath = path.join(uploadsDir, path.basename(localPath));
	try {
		unlinkSync(diskPath);
	} catch {}
}
