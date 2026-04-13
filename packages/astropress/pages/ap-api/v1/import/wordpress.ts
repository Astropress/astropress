import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { getCmsConfig } from "astropress";
import { createAstropressWordPressImportSource } from "astropress/import/wordpress.js";

export const POST: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) {
    return apiErrors.notFound("REST API is not enabled.");
  }

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) {
    return apiErrors.notFound("API token store unavailable.");
  }

  return withApiRequest(
    context.request,
    { apiTokens: store.apiTokens, checkRateLimit: store.checkRateLimit, rateLimit: 5 },
    ["import:write"],
    async () => {
      let body: Record<string, unknown>;
      try {
        body = await context.request.json() as Record<string, unknown>;
      } catch {
        return apiErrors.validationError("Request body must be valid JSON.");
      }

      const exportFile = typeof body.exportFile === "string" ? body.exportFile.trim() : "";
      if (!exportFile) {
        return apiErrors.validationError("exportFile is required.");
      }

      const source = createAstropressWordPressImportSource();
      const report = await source.importWordPress({
        exportFile,
        applyLocal: true,
        workspaceRoot: process.cwd(),
      });

      return jsonOk(report as unknown as Record<string, unknown>);
    },
  );
};
