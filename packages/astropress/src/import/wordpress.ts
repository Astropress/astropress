import { readFile } from "node:fs/promises";
import type { ImportSource } from "../platform-contracts";

export interface AstropressWordPressImportSourceOptions {
  sourceUrl?: string;
}

function countMatches(source: string, pattern: RegExp) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

export function createAstropressWordPressImportSource(
  options: AstropressWordPressImportSourceOptions = {},
): ImportSource {
  return {
    async importWordPress(input) {
      if (!input.exportFile) {
        throw new Error("WordPress import requires an `exportFile` path.");
      }

      const source = await readFile(input.exportFile, "utf8");
      const importedRecords = countMatches(source, /<item\b/gi);
      const importedMedia = input.includeMedia === false ? 0 : countMatches(source, /<wp:attachment_url>/gi);

      return {
        importedRecords,
        importedMedia,
      };
    },
  };
}
