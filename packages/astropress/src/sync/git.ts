import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { GitSyncAdapter } from "../platform-contracts";

export interface AstropressGitSyncAdapterOptions {
  projectDir: string;
  include?: string[];
}

const defaultEntries = ["package.json", "astro.config.mjs", "src", "public", "content", "db", "tests"];

async function pathExists(pathname: string) {
  try {
    await stat(pathname);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(pathname: string): Promise<number> {
  const metadata = await stat(pathname);
  if (!metadata.isDirectory()) {
    return 1;
  }

  const entries = await readdir(pathname, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    total += await countFiles(join(pathname, entry.name));
  }
  return total;
}

export function createAstropressGitSyncAdapter(options: AstropressGitSyncAdapterOptions): GitSyncAdapter {
  const projectDir = resolve(options.projectDir);
  const include = options.include ?? defaultEntries;

  return {
    async exportSnapshot(targetDir) {
      const outputDir = resolve(targetDir);
      await rm(outputDir, { recursive: true, force: true });
      await mkdir(outputDir, { recursive: true });

      let fileCount = 0;
      for (const entry of include) {
        const sourcePath = resolve(projectDir, entry);
        if (!(await pathExists(sourcePath))) {
          continue;
        }

        const destinationPath = resolve(outputDir, entry);
        await mkdir(dirname(destinationPath), { recursive: true });
        await cp(sourcePath, destinationPath, { recursive: true });
        fileCount += await countFiles(sourcePath);
      }

      return { targetDir: outputDir, fileCount };
    },
    async importSnapshot(sourceDir) {
      const inputDir = resolve(sourceDir);
      let fileCount = 0;

      for (const entry of include) {
        const sourcePath = resolve(inputDir, entry);
        if (!(await pathExists(sourcePath))) {
          continue;
        }

        const destinationPath = resolve(projectDir, entry);
        await rm(destinationPath, { recursive: true, force: true });
        await mkdir(dirname(destinationPath), { recursive: true });
        await cp(sourcePath, destinationPath, { recursive: true });
        fileCount += await countFiles(sourcePath);
      }

      return { sourceDir: inputDir, fileCount };
    },
  };
}
