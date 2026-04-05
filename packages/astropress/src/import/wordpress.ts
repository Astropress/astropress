import { readFile } from "node:fs/promises";
import type {
  AstropressWordPressImportInventory,
  AstropressWordPressImportPlan,
  AstropressWordPressImportReport,
  ImportSource,
} from "../platform-contracts";

export interface AstropressWordPressImportSourceOptions {
  sourceUrl?: string;
}

function countMatches(source: string, pattern: RegExp) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

async function inspectWordPressExport(
  input: Parameters<ImportSource["importWordPress"]>[0],
): Promise<AstropressWordPressImportInventory> {
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
    warnings: source.includes("[")
      ? ["Potential shortcode or builder markup detected; manual review may be required."]
      : [],
  };
}

export function createAstropressWordPressImportSource(
  options: AstropressWordPressImportSourceOptions = {},
): ImportSource {
  return {
    async inspectWordPress(input) {
      return inspectWordPressExport({
        ...input,
        sourceUrl: input.sourceUrl ?? options.sourceUrl,
      });
    },
    async importWordPress(input) {
      const plan: AstropressWordPressImportPlan = {
        sourceUrl: input.sourceUrl ?? options.sourceUrl,
        exportFile: input.exportFile,
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true,
      };
      const inventory = await inspectWordPressExport({
        ...input,
        sourceUrl: plan.sourceUrl,
      });

      const report: AstropressWordPressImportReport = {
        importedRecords: inventory.detectedRecords,
        importedMedia: plan.includeMedia ? inventory.detectedMedia : 0,
        importedComments: plan.includeComments ? inventory.detectedComments : 0,
        importedUsers: plan.includeUsers ? inventory.detectedUsers : 0,
        plan,
        inventory,
        warnings: inventory.warnings,
      };

      return report;
    },
  };
}
