import { readFile } from "node:fs/promises";

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

export function createAstropressWordPressImportSource() {
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
