import { readFile } from "node:fs/promises";

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function detectUnsupportedPatterns(source) {
  const shortcodeMatches = countMatches(source, /\[[a-z][^\]]*\]/gi);
  const builderMatches = countMatches(source, /(elementor|vc_row|wp-block-|et_pb_|fusion_)/gi);
  const unsupportedPatterns = [];
  const warnings = [];
  if (shortcodeMatches > 0) {
    unsupportedPatterns.push("shortcodes");
    warnings.push("WordPress shortcodes were detected; imported content will need manual review.");
  }
  if (builderMatches > 0) {
    unsupportedPatterns.push("page-builder-markup");
    warnings.push("WordPress page-builder markup was detected; imported content will need manual cleanup.");
  }
  return {
    shortcodeMatches,
    builderMatches,
    unsupportedPatterns,
    warnings
  };
}

function buildImportPlan(inventory, overrides = {
  includeComments: true,
  includeUsers: true,
  includeMedia: true
}) {
  const includeComments = overrides.includeComments ?? inventory.detectedComments > 0;
  const includeUsers = overrides.includeUsers ?? inventory.detectedUsers > 0;
  const includeMedia = overrides.includeMedia ?? inventory.detectedMedia > 0;
  const manualTasks = [...inventory.warnings];
  return {
    sourceUrl: inventory.sourceUrl,
    exportFile: inventory.exportFile,
    includeComments,
    includeUsers,
    includeMedia,
    reviewRequired: inventory.unsupportedPatterns.length > 0,
    manualTasks
  };
}

async function inspectWordPressExport(input) {
  if (!input.exportFile) {
    throw new Error("WordPress import requires an `exportFile` path.");
  }
  const source = await readFile(input.exportFile, "utf8");
  const unsupported = detectUnsupportedPatterns(source);
  return {
    exportFile: input.exportFile,
    sourceUrl: input.sourceUrl,
    detectedRecords: countMatches(source, /<item\b/gi),
    detectedMedia: countMatches(source, /<wp:attachment_url>/gi),
    detectedComments: countMatches(source, /<wp:comment>/gi),
    detectedUsers: countMatches(source, /<wp:author>/gi),
    detectedShortcodes: unsupported.shortcodeMatches,
    detectedBuilderMarkers: unsupported.builderMatches,
    unsupportedPatterns: unsupported.unsupportedPatterns,
    warnings: unsupported.warnings
  };
}

export function createAstropressWordPressImportSource() {
  return {
    async inspectWordPress(input) {
      return inspectWordPressExport(input);
    },
    async planWordPressImport(input) {
      return buildImportPlan(input.inventory, {
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true
      });
    },
    async importWordPress(input) {
      const inventory = await inspectWordPressExport({
        ...input,
        sourceUrl: input.sourceUrl
      });
      const plan = input.plan ?? buildImportPlan(inventory, {
        includeComments: input.includeComments ?? true,
        includeUsers: input.includeUsers ?? true,
        includeMedia: input.includeMedia ?? true
      });
      return {
        importedRecords: inventory.detectedRecords,
        importedMedia: plan.includeMedia ? inventory.detectedMedia : 0,
        importedComments: plan.includeComments ? inventory.detectedComments : 0,
        importedUsers: plan.includeUsers ? inventory.detectedUsers : 0,
        reviewRequired: plan.reviewRequired,
        manualTasks: plan.manualTasks,
        plan,
        inventory,
        warnings: [...inventory.warnings, ...plan.manualTasks].filter((warning, index, all) => all.indexOf(warning) === index)
      };
    }
  };
}
