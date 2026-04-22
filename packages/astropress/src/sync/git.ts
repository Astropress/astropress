import {
	constants,
	copyFile,
	mkdir,
	readdir,
	rm,
	stat,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { GitSyncAdapter } from "../platform-contracts";
import { checkpointSqliteWal } from "../sqlite-bootstrap-helpers";

export interface AstropressGitSyncAdapterOptions {
	projectDir: string;
	include?: string[];
	logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

const defaultEntries = [
	"package.json",
	"astro.config.mjs",
	"src",
	"public",
	"content",
	"db",
	"tests",
];

async function pathExists(pathname: string) {
	try {
		await stat(pathname);
		return true;
	} catch {
		return false;
	}
}

async function copyFileWithReflink(
	src: string,
	dest: string,
): Promise<boolean> {
	try {
		await copyFile(src, dest, constants.COPYFILE_FICLONE);
		return true;
	} catch (err: unknown) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOTSUP" || code === "EOPNOTSUPP" || code === "EXDEV") {
			await copyFile(src, dest);
			return false;
		}
		throw err;
	}
}

// Recursive directory copy using COPYFILE_FICLONE (reflink) per file.
// For .sqlite files, checkpoints WAL first so the main file is self-contained.
async function copyTreeWithReflink(
	src: string,
	dest: string,
	warn: (msg: string) => void,
): Promise<{ fileCount: number; usedReflink: boolean }> {
	const metadata = await stat(src);

	if (!metadata.isDirectory()) {
		if (src.endsWith(".sqlite")) {
			await checkpointSqliteWal(src, warn);
		}
		const usedReflink = await copyFileWithReflink(src, dest);
		return { fileCount: 1, usedReflink };
	}

	await mkdir(dest, { recursive: true });
	const entries = await readdir(src, { withFileTypes: true });
	let fileCount = 0;
	let usedReflink = false;

	for (const entry of entries) {
		const r = await copyTreeWithReflink(
			join(src, entry.name),
			join(dest, entry.name),
			warn,
		);
		fileCount += r.fileCount;
		usedReflink = usedReflink || r.usedReflink;
	}

	return { fileCount, usedReflink };
}

async function processIncludes(
	includes: string[],
	srcBase: string,
	destBase: string,
	warn: (msg: string) => void,
): Promise<{ fileCount: number; anyReflink: boolean }> {
	let fileCount = 0;
	let anyReflink = false;
	for (const entry of includes) {
		const src = resolve(srcBase, entry);
		if (!(await pathExists(src))) continue;
		const dest = resolve(destBase, entry);
		await mkdir(dirname(dest), { recursive: true });
		const r = await copyTreeWithReflink(src, dest, warn);
		fileCount += r.fileCount;
		anyReflink = anyReflink || r.usedReflink;
	}
	return { fileCount, anyReflink };
}

export function createAstropressGitSyncAdapter(
	options: AstropressGitSyncAdapterOptions,
): GitSyncAdapter {
	const projectDir = resolve(options.projectDir);
	const include = options.include ?? defaultEntries;
	const log = options.logger?.info ?? (() => {});
	const warn = options.logger?.warn ?? (() => {});

	return {
		async exportSnapshot(targetDir) {
			const outputDir = resolve(targetDir);
			await rm(outputDir, { recursive: true, force: true });
			await mkdir(outputDir, { recursive: true });
			const { fileCount, anyReflink } = await processIncludes(
				include,
				projectDir,
				outputDir,
				warn,
			);
			log(
				anyReflink
					? `Snapshot exported using copy-on-write (reflink): ${fileCount} file(s)`
					: `Snapshot exported using standard copy: ${fileCount} file(s)`,
			);
			return { targetDir: outputDir, fileCount };
		},
		async importSnapshot(sourceDir) {
			const inputDir = resolve(sourceDir);
			// Remove existing entries before restoring, unlike export which starts fresh.
			for (const entry of include) {
				await rm(resolve(projectDir, entry), { recursive: true, force: true });
			}
			const { fileCount, anyReflink } = await processIncludes(
				include,
				inputDir,
				projectDir,
				warn,
			);
			log(
				anyReflink
					? `Snapshot imported using copy-on-write (reflink): ${fileCount} file(s)`
					: `Snapshot imported using standard copy: ${fileCount} file(s)`,
			);
			return { sourceDir: inputDir, fileCount };
		},
	};
}
