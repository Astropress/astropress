import type { APIRoute } from "astro";
import { requireAdminFormAction } from "astropress";
import { parseWordPressExport } from "../../../src/import/wordpress-xml.js";
import { applyImportToLocalRuntime } from "../../../src/import/wordpress-apply.js";
import { parseWixExport } from "../../../src/import/wix.js";
import { applyWixImportToLocalRuntime } from "../../../src/import/wix-apply.js";
import { crawlSitePages } from "../../../src/import/page-crawler.js";
import { createLogger } from "../../../src/runtime-logger.js";

const logger = createLogger("import-start");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  const guard = await requireAdminFormAction(context, {
    failurePath: "/ap-admin/import",
    requireAdmin: true,
  });
  if (!guard.ok) return guard.response;

  const { formData } = guard;
  const source = String(formData.get("source") ?? "").trim();
  const dryRun = formData.get("dryRun") === "true" || formData.get("dryRun") === "1";
  const applyLocal = !dryRun;
  const workspaceRoot = process.cwd();

  try {
    if (source === "wordpress") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return jsonResponse({ ok: false, error: "A WordPress XML export file is required." }, 400);
      }
      const xmlText = await file.text();
      const bundle = parseWordPressExport(xmlText);

      let appliedRecords = 0;
      let appliedMedia = 0;
      if (applyLocal) {
        const report = await applyImportToLocalRuntime({
          bundle,
          workspaceRoot,
          plan: {
            exportFile: file.name,
            includeComments: true,
            includeUsers: true,
            includeMedia: true,
            downloadMedia: false,
            applyLocal: true,
            permalinkStrategy: "preserve-wordpress-links",
            resumeSupported: false,
            entityCounts: bundle.entityCounts,
            reviewRequired: bundle.unsupportedPatterns.length > 0,
            manualTasks: bundle.warnings,
          },
        });
        appliedRecords = report.appliedRecords;
        appliedMedia = report.appliedMedia;
      }

      return jsonResponse({
        ok: true,
        dryRun,
        source: "wordpress",
        detected: {
          content: bundle.contentRecords.length,
          media: bundle.mediaAssets.length,
          comments: bundle.comments.length,
          authors: bundle.authors.length,
        },
        applied: applyLocal ? { records: appliedRecords, media: appliedMedia } : null,
        warnings: bundle.warnings,
        manualTasks: bundle.remediationCandidates.length > 0
          ? ["Review remediation candidates for shortcode or page-builder markup before publishing."]
          : [],
      });
    }

    if (source === "wix") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return jsonResponse({ ok: false, error: "A Wix CSV export file is required." }, 400);
      }
      const csvText = await file.text();
      const bundle = parseWixExport(csvText);

      let appliedRecords = 0;
      let appliedMedia = 0;
      if (applyLocal) {
        const report = await applyWixImportToLocalRuntime({ bundle, workspaceRoot });
        appliedRecords = report.appliedRecords;
        appliedMedia = report.appliedMedia;
      }

      return jsonResponse({
        ok: true,
        dryRun,
        source: "wix",
        detected: {
          content: bundle.contentRecords.length,
          media: bundle.mediaAssets.length,
          authors: bundle.authors.length,
        },
        applied: applyLocal ? { records: appliedRecords, media: appliedMedia } : null,
        warnings: bundle.warnings,
        manualTasks: [],
      });
    }

    if (source === "crawl") {
      const startUrl = String(formData.get("url") ?? "").trim();
      const maxPages = Math.min(Number(formData.get("maxPages") ?? "100"), 10000);

      if (!startUrl) {
        return jsonResponse({ ok: false, error: "A start URL is required for web crawl." }, 400);
      }

      const result = await crawlSitePages({ siteUrl: startUrl, maxPages });

      return jsonResponse({
        ok: true,
        dryRun,
        source: "crawl",
        detected: { content: result.pages.length, media: 0, authors: 0 },
        applied: null,
        warnings: result.warnings,
        manualTasks: result.pages.length > 0
          ? ["Crawl complete. Run `astropress import crawl --url <site> --apply-local` to save content to the database."]
          : ["No pages were crawled. Check that the site is publicly accessible."],
        failedUrls: result.failed.length,
      });
    }

    return jsonResponse({ ok: false, error: `Unknown import source: ${source}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed unexpectedly.";
    logger.error("import-start failed", { source, message });
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
