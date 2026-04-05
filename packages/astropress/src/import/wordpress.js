import { readFile } from "node:fs/promises";

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

async function inspectWordPressExport(input) {
  if (!input.exportFile) {
    throw new Error("WordPress import requires an `exportFile` path.");
  }
  const source = await readFile(input.exportFile, "utf8");
  return {
    exportFile: input.exportFile,
    sourceUrl: input.sourceUrl,
    detectedRecords: countMatches(source, /<item\b/gi),
    detectedMedia: countMatches(source, /<wp:attachment_url>/gi),
    detectedComments: countMatches(source, /<wp:comment>/gi),
    detectedUsers: countMatches(source, /<wp:author>/gi),
    warnings: source.includes("[") ? [
      "Potential shortcode or builder markup detected; manual review may be required."
    ] : []
  };
}

export function createAstropressWordPressImportSource() {
  return {
    async inspectWordPress(input) {
      return inspectWordPressExport(input);
    },
    async importWordPress(input) {
      const plan = {
        sourceUrl: input.sourceUrl,
        exportFile: input.exportFile,
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true
      };
      const inventory = await inspectWordPressExport({
        ...input,
        sourceUrl: plan.sourceUrl
      });
      return {
        importedRecords: inventory.detectedRecords,
        importedMedia: plan.includeMedia ? inventory.detectedMedia : 0,
        importedComments: plan.includeComments ? inventory.detectedComments : 0,
        importedUsers: plan.includeUsers ? inventory.detectedUsers : 0,
        plan,
        inventory,
        warnings: inventory.warnings
      };
    }
  };
}
